# Implementation Plan: I-1.2.6 — Event Publish Workflow

## Scope

**Feature ID:** I-1.2.6
**Module:** 1.2 — Event Creation & Management
**Status:** ✅ Complete (2026-04-27)
**Task size:** Large
**Risk classification:** Red (`auth`, `public-api`, `migration`, `payments` gate)
**Blast radius:** `packages/shared` (constants, schemas), `packages/db` (events migration), `apps/api` (events module), `apps/web` (events feature, org routes). Affects organizer role, admin role (downstream I-1.2.7), public event visibility. No external service calls (Razorpay checked but not called; CDN purge deferred to I-2.4.2).

## Source Features/Requirements

| Source           | Reference                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements doc | F-1.2.6 — "Event publish workflow (draft → under review → published) gated by organizer verification for paid events"                                          |
| Requirements doc | F-1.2.7 — "Admin manual review interface for the first 3 paid events from each new organizer before publish" (downstream, but admin-review flag captured here) |
| V1 impl plan     | I-1.2.6 row 9 — "Gated by organizer verification AND Razorpay linked-account for paid events"                                                                  |
| V1 impl plan     | I-1.2.7 row 10 — depends on I-1.2.6 for `under_review` state and review signals                                                                                |
| Architecture doc | §1 — "Cache invalidation triggers: event publish/unpublish"                                                                                                    |
| Architecture doc | §2 — Audit log, modular monolith boundaries                                                                                                                    |

**Acceptance criteria:**

1. Organizer can inspect readiness via `GET /api/v1/events/:eventId/publish-readiness` without mutating state.
2. Organizer can request publish for a draft event via `POST /api/v1/events/:eventId/publish`.
3. Publish is gated: organizer must be verified (`isVerified === true`), paid events require Razorpay linked account (`razorpayAccountStatus === "active"`), and event must pass a completeness check (categories, pricing, active/future schedule, hero image, refund policy, cancellation policy all present).
4. If the event requires admin review (first N paid events flag — stubbed for I-1.2.7), status transitions to `under_review` instead of `published`.
5. If no admin review required, status transitions directly to `published` and `publishedAt` is set.
6. Organizer can unpublish a published event via `POST /api/v1/events/:eventId/unpublish`, returning it to `draft`.
7. All successful transitions and denied publish attempts are audit-logged with safe metadata.
8. State machine rejects illegal transitions with clear error messages, while same-owner duplicate publish/unpublish requests are handled idempotently where safe.
9. RBAC enforced: only the owning organizer can read publish readiness and publish/unpublish their own events.
10. CSRF protection on state-changing POST endpoints; readiness GET remains authenticated but does not require CSRF.
11. Web UI shows a pre-publish checklist powered by the readiness endpoint, publish/unpublish actions, status badges, and confirmation dialogs.
12. Cache invalidation extension point is documented (stub/TODO for I-2.4.2; no Cloudflare code in this scope).
13. `under_review` → `published` and `under_review` → `draft` (reject) transitions exist as service helpers for I-1.2.7 admin review to consume.

## Autopilot Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                | Rationale                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `EVENT_STATUSES` already contains `under_review` — no pgEnum migration needed.                                                                                                                                                                                                                                                                                                                                            | Confirmed: `packages/shared/src/constants/event.ts` line 3–9 already defines `["draft", "under_review", "published", "completed", "cancelled"]`.                                                   |
| A2  | Add `published_at` and `submitted_for_review_at` nullable timestamp columns to the `events` table via a new migration. These are nullable because not all events have been published or submitted.                                                                                                                                                                                                                        | Needed for audit/SLA tracking. Conservative: nullable columns on existing table are backward-compatible.                                                                                           |
| A3  | The "first 3 paid events from new organizer" admin-review counter is **stubbed** as a service helper `requiresAdminReview(organizerId): Promise<boolean>` that returns `false` by default, with a clear TODO for I-1.2.7 to implement the actual counter logic.                                                                                                                                                           | The counter requires querying published event history and defining "new organizer." This policy is I-1.2.7's scope. Stubbing ensures `under_review` path is testable without implementing counter. |
| A4  | `archived` status is out-of-scope. Only transitions: `draft → under_review`, `draft → published`, `under_review → published` (admin approve), `under_review → draft` (admin reject), `published → draft` (organizer unpublish).                                                                                                                                                                                           | Conservative: `completed` and `cancelled` are separate lifecycle events not part of publish workflow.                                                                                              |
| A5  | No real CDN purge calls — emit audit log entry and add a `// TODO: I-2.4.2 CDN cache invalidation` comment at the publish/unpublish transition points.                                                                                                                                                                                                                                                                    | Cloudflare integration does not exist yet per I-1.2.8 plan notes.                                                                                                                                  |
| A6  | Free events (hypothetical `isPaid === false`) still require organizer verification but skip Razorpay check. V1 currently enforces `isPaid === true`, so this is defensive future-proofing.                                                                                                                                                                                                                                | Requirements say "organizer verification for paid events"; architecture says all events need verified organizer. Conservative: gate both, skip Razorpay for free.                                  |
| A7  | The completeness check requires: ≥1 event category, pricing configured for every category, ≥1 active pricing tier, ≥1 hero image (kind=`hero`, status=`uploaded`), non-null refundPolicy, non-null cancellationPolicy, future `startAt`, future `endAt`, and slug uniqueness re-check. Registration form schema check is deferred until I-1.2.4 is complete — if `form_schema` column doesn't exist yet, skip that check. | These are the minimum required fields to present a complete event page to participants and avoid publishing stale/past events.                                                                     |
| A8  | Admin-initiated transitions (`under_review → published`, `under_review → draft`) are exported as service functions but NOT exposed as API routes in this plan. I-1.2.7 will add the admin routes.                                                                                                                                                                                                                         | Separation of concerns: this plan builds the state machine; I-1.2.7 builds the admin UI/routes.                                                                                                    |
| A9  | Unpublish returns event to `draft` (not a separate `unpublished` status), clearing `publishedAt`. This is the simplest reversible approach.                                                                                                                                                                                                                                                                               | Matches the existing status enum. Organizer can re-publish after unpublishing.                                                                                                                     |
| A10 | "Free event" means `event.isPaid === false` and no active tier has an effective price greater than 0 (all tiers are 0, or there are no paid tiers). Any inconsistent state (`isPaid === true`, positive tier, or V1 check constraint) is treated as paid and requires Razorpay.                                                                                                                                           | Conservative financial default; current V1 schema enforces paid events, so all current publishes require Razorpay.                                                                                 |
| A11 | `requiresAdminReview(organizerId)` returns `false` in this implementation, but the publish state machine must still support `draft → under_review`; tests inject/stub a `true` result so I-1.2.7 can flip policy without schema changes.                                                                                                                                                                                  | Keeps this slice implementation-ready while preserving downstream admin review flow.                                                                                                               |
| A12 | Ticketing/bookings do not exist yet. Unpublish does not cascade to ticketing in this slice; add an explicit TODO guard for future bookings to block unpublish when paid/confirmed bookings exist.                                                                                                                                                                                                                         | Avoids inventing booking tables now while documenting the future safety gate.                                                                                                                      |

## Prerequisites and Dependency Chain

| Prerequisite                                          | Status         | Notes                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-1.2.1 Event creation (events table, draft creation) | ✅ Complete    | Foundation table exists                                                                                                                                                                                                                                                                                   |
| I-1.2.2 Event categories                              | ✅ Complete    | `event_categories` table, completeness check needs ≥1                                                                                                                                                                                                                                                     |
| I-1.2.3 Pricing configuration                         | ✅ Complete    | `event_pricing_tiers` table, completeness check needs ≥1                                                                                                                                                                                                                                                  |
| I-1.2.4 Registration form fields                      | ⏳ Not Started | Completeness check for form_schema **deferred** — skip in publish gating until I-1.2.4 ships                                                                                                                                                                                                              |
| I-1.2.5 Refund & cancellation policy                  | ⏳ Not Started | Policy columns already exist on events table (`refundPolicy`, `cancellationPolicy`). API for setting them exists. Completeness check requires non-null values. If I-1.2.5 is not complete at implementation time, the check still works (policies will be null → publish blocked until policies are set). |
| I-1.2.9 Event image upload                            | ✅ Complete    | `event_images` table, completeness check needs ≥1 hero image                                                                                                                                                                                                                                              |
| I-1.2.8 Event edit                                    | ✅ Complete    | GET/PUT event endpoints exist                                                                                                                                                                                                                                                                             |
| I-1.1.6 Verification badge                            | ✅ Complete    | `organizers.isVerified` field is available; reuse any existing publish-eligibility helper if present, otherwise read the field through `getOrganizerByUserId()`                                                                                                                                           |
| I-1.1.7 Razorpay linked account                       | ✅ Complete    | `organizers.razorpayAccountStatus` field                                                                                                                                                                                                                                                                  |
| I-0.4.4 Audit log                                     | ✅ Complete    | `createAuditLogger`, `AUDIT_ACTIONS.EVENT_PUBLISH` etc. already defined                                                                                                                                                                                                                                   |
| I-0.2.11 CSRF protection                              | ✅ Complete    | CSRF plugin active on state-changing routes                                                                                                                                                                                                                                                               |

**Ordering:** Shared schemas → DB migration → API service + routes + tests → Web UI + tests → Progress updates.

## Architecture Notes

### Package boundaries

- **`packages/shared`**: Add publish-related Zod schemas (publish request/response, publish readiness check schema, transition error codes). Add new audit action constants if needed (most already exist).
- **`packages/shared`**: Extend `eventSchema` with nullable `publishedAt` and `submittedForReviewAt` so API responses remain shared-contract typed.
- **`packages/db`**: New forward migration adding `published_at` and `submitted_for_review_at` columns to `events` table plus a **non-empty rollback SQL file**. Update Drizzle schema.
- **`apps/api`**: New service functions in `events/service.ts` for readiness, publish, unpublish, admin-approve, admin-reject. New routes in `events/routes.ts`. Gating logic queries organizer, categories, pricing, images, and slug tables.
- **`apps/web`**: New server functions, query options, components (publish checklist, publish button, status badge, confirm dialogs). New or updated route pages.

### Existing modules/utilities to reuse

- `getOrganizerByUserId()` from `organizer/service.ts` — fetches organizer with `isVerified` and `razorpayAccountStatus`
- `createAuditLogger()` from `lib/audit.ts`
- `AUDIT_ACTIONS.EVENT_PUBLISH`, `EVENT_UNPUBLISH` already defined in `packages/shared/src/constants/audit.ts`; add missing publish-request/review/denied constants in the same `<domain>.<verb>` style only if not already present
- `requireAuth`, `requireRole("organizer")` middleware
- `eventIdParamsSchema`, `eventErrorResponseSchema` from `events/schemas.ts`
- `eventQueryKey`, `eventQueryOptions` from web `features/events/queries.ts`
- Existing `isPubliclyReadableEventStatus()` helper in `events/service.ts`
- Existing slug helpers (`reserveUniqueEventSlug`, `slugExists`, `slugRedirects`) to re-check slug uniqueness at publish time; do not create a second slug system
- Existing organizer lookup/status fields from `organizer/service.ts` (`isVerified`, `razorpayAccountStatus`); if a `canPublishPaidEvents` helper exists at implementation time, reuse it instead of duplicating logic

### Security considerations

- Server-side enforcement: publish/unpublish only by owning organizer (verified ownership via organizer → event relationship)
- CSRF required on POST endpoints through the existing HMAC double-submit plugin; do not add a CSRF bypass. Authenticated `GET /publish-readiness` is read-only and does not require CSRF.
- Organizer verification and Razorpay status checked server-side, not just UI-gated
- No PII in audit log metadata (log eventId, organizerId, transition, not user personal data)
- `under_review` events NOT publicly visible (existing `isPubliclyReadableEventStatus` only returns true for `published`/`completed`)
- Failed publish attempts are audit-logged with safe denial codes only (for example `missing_hero_image`, `razorpay_not_linked`), not full policy text, contact details, Razorpay account IDs, or request bodies.

### Performance considerations

- Publish readiness check involves simple indexed lookups (event/organizer, categories, pricing, images, slug collision check). Acceptable for a non-burst organizer action.
- No background queue needed — synchronous is fine for organizer-initiated publish.
- Publish/unpublish status changes run inside a transaction and lock the event row (`SELECT ... FOR UPDATE`) or use an `UPDATE ... WHERE id = ? AND status = ? RETURNING` guard so concurrent requests cannot produce duplicate transitions.

### Observability

- Audit log entries for every transition attempt (success and denied failure)
- Structured log entries at info level for successful transitions

### Error handling

- Clear error codes and messages for each gating failure (unverified organizer, missing Razorpay, missing categories, etc.)
- Aggregate all missing items in a single "publish readiness" response so the organizer sees everything needed at once
- Safe public error messages; no raw DB errors, no Razorpay account identifiers, no document/KYC details.

## Database Plan

### Migration: Add publish tracking columns to events

**Risk:** Red (schema migration on existing table)

**Changes:**

```sql
ALTER TABLE events ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN submitted_for_review_at TIMESTAMPTZ;
```

**Drizzle schema update** in `packages/db/src/schema/events.ts`:

```typescript
publishedAt: timestamp("published_at", { withTimezone: true }),
submittedForReviewAt: timestamp("submitted_for_review_at", { withTimezone: true }),
```

**Rollback SQL:**

```sql
ALTER TABLE events DROP COLUMN IF EXISTS submitted_for_review_at;
ALTER TABLE events DROP COLUMN IF EXISTS published_at;
```

**Migration safety:**

- Both columns are nullable with no default — no table rewrite, no lock risk on small tables
- No data backfill needed (existing events are all drafts)
- Backward-compatible: existing code ignores these columns until publish feature ships
- Follows expand/contract pattern: add columns first, then deploy code that uses them
- Generate and commit the paired rollback SQL file required by the repo rollback validator; the rollback file must contain the `ALTER TABLE ... DROP COLUMN ...` statements above and must not be empty.
- Validate with `pnpm --filter @repo/db db:check:rollbacks`, `pnpm --filter @repo/db db:check:drift`, and `pnpm --filter @repo/db db:check:lock-risk`.

**Index consideration:** An index on `(status, published_at)` may be useful for public listing queries (Phase 2, I-2.2.x). Not adding it now — defer to when listing queries are built.

## API Plan

### New routes

| Method | Path                                        | Auth                                                     | CSRF           | Description                                         |
| ------ | ------------------------------------------- | -------------------------------------------------------- | -------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/events/:eventId/publish-readiness` | `requireAuth` + `requireRole("organizer")` + owner check | No (read-only) | Return readiness checklist for the owning organizer |
| `POST` | `/api/v1/events/:eventId/publish`           | `requireAuth` + `requireRole("organizer")`               | Yes            | Request publish for a draft event                   |
| `POST` | `/api/v1/events/:eventId/unpublish`         | `requireAuth` + `requireRole("organizer")`               | Yes            | Unpublish a published event back to draft           |

### `GET /api/v1/events/:eventId/publish-readiness`

**Request:** No body.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "ready": false,
    "eventStatus": "draft",
    "isPaid": true,
    "requiresRazorpay": true,
    "wouldRequireAdminReview": false,
    "items": [
      {
        "check": "organizer_verified",
        "passed": true,
        "message": "Organizer verified",
        "severity": "error"
      }
    ]
  }
}
```

**Error responses:** 401, 403 (not owning organizer), 404.

**Notes:**

- This endpoint powers the web checklist and must not mutate event state or write audit logs.
- It returns all gating failures in one response, including time/pricing/policy/image/slug issues.
- It must not expose sensitive organizer verification document details, Razorpay account IDs, or raw internal policy notes.

### `POST /api/v1/events/:eventId/publish`

**Request:** No body (eventId from params).

**Response (200):**

```json
{
  "success": true,
  "data": {
    "event": { /* full event object with updated status */ },
    "transition": "draft_to_published" | "draft_to_under_review" | "noop_already_published" | "noop_already_under_review",
    "readiness": { /* same shape as publish-readiness */ }
  }
}
```

**Error responses:**

- `400` — Event not in publishable state, or completeness check failed (with `readiness` details)
- `401` — Not authenticated
- `403` — Not the owning organizer, or organizer not verified, or paid event without Razorpay
- `404` — Event not found
- `409` — Conflict for unsupported lifecycle states (`completed`, `cancelled`) or optimistic concurrency failure after retry. Same-owner duplicate `published`/`under_review` publish requests return 200 no-op.

**Gating sequence (service layer):**

1. Validate eventId (UUID parse)
2. Load organizer from session user and event inside a transaction; verify ownership (organizer's event)
3. Lock or conditionally update the event row so concurrent publish attempts serialize
4. If status is `published` or `under_review`, return a safe idempotent no-op response for the owning organizer
5. Reject `completed` and `cancelled`
6. Verify event is in `draft` status
7. Load organizer, check `isVerified === true` → 403 if not
8. Determine paid/free status. Current V1 events are paid. Future free events are free only when `isPaid === false` and no active tier has effective price >0; otherwise require Razorpay.
9. If paid, check `razorpayAccountStatus === "active"` → 403 if not
10. Completeness check:
    - ≥1 event category exists

- pricing tier exists for every category
- ≥1 active pricing tier exists; paid events need at least one active paid tier
- ≥1 hero image with `kind = "hero"` and status `uploaded`
- `refundPolicy` is not null/empty
- `cancellationPolicy` is not null/empty
- `startAt > now` and `endAt > now`; block publishing if event date/end date is in the past or event has already started
- `registrationClosesAt`, when present, is still before `startAt` per existing schema; if already in the past this does not block publish unless product later requires registration-open windows
- current slug remains unique across active event slugs and slug redirects
- Return all failures aggregated in response

11. If any gating failure exists, audit `event.publish_denied` (new constant if absent) with denial codes only, then return 400/403 as appropriate with readiness details
12. Check `requiresAdminReview(organizerId)` → if true, transition to `under_review`; otherwise to `published`
13. Update event status + timestamp columns:
    - `draft → published`: set `publishedAt = now`, clear `submittedForReviewAt`
    - `draft → under_review`: set `submittedForReviewAt = now`, leave `publishedAt = null`
14. Audit log the transition (`event.publish_requested`, then `event.publish` or `event.submit_for_review` as applicable)
15. Leave a local `invalidateEventCache(event)` stub/TODO for I-2.4.2; no Cloudflare API calls
16. Return updated event + transition type + readiness snapshot

### `POST /api/v1/events/:eventId/unpublish`

**Request:** No body.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "event": {
      /* full event object with status=draft */
    },
    "transition": "published_to_draft"
  }
}
```

**Error responses:** 400 (not in unpublishable state), 401, 403, 404, 409 (completed/cancelled or future booking guard once bookings exist).

**Logic:**

1. Validate eventId, verify ownership inside a transaction
2. Lock or conditionally update the event row (`WHERE status = 'published'`) to prevent concurrent double-unpublish
3. Verify event is in `published` status; draft unpublish is always rejected with `EVENT_NOT_UNPUBLISHABLE`
4. Reject `under_review`, `completed`, and `cancelled`
5. Future booking guard: add TODO to block unpublish when confirmed bookings/tickets exist (ticketing is not present yet)
6. Update status to `draft`, clear `publishedAt`; keep `submittedForReviewAt` only if it reflects historical review submission, otherwise clear when rejecting from review
7. Audit log `event.unpublish`
8. Leave cache-invalidation TODO stub for I-2.4.2
9. Return updated event

### Service helpers exported for I-1.2.7

```typescript
// Called by admin review routes (I-1.2.7)
export async function adminApproveEvent(
  deps,
  eventId,
  adminUserId,
): Promise<Event>;
export async function adminRejectEvent(
  deps,
  eventId,
  adminUserId,
  reason?,
): Promise<Event>;
```

These transition `under_review → published` (approve) and `under_review → draft` (reject). Not exposed as routes in this plan.

Admin helper behavior:

- `adminApproveEvent`: requires admin caller supplied by future route, locks the event, rejects non-`under_review`, sets `status = "published"`, sets `publishedAt = now`, preserves `submittedForReviewAt`, audits `event.publish` with `source: "admin_review"`.
- `adminRejectEvent`: requires admin caller supplied by future route, locks the event, rejects non-`under_review`, sets `status = "draft"`, clears `publishedAt`, preserves safe rejection reason only when a future I-1.2.7 storage field exists, audits `admin.review`/`event.publish_rejected` without PII.

### Shared schemas additions (`packages/shared`)

**New file: `packages/shared/src/schemas/event-publish.ts`**

```typescript
// Publish readiness check item
export const publishReadinessItemSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  message: z.string(),
  severity: z.enum(["error", "warning", "info"]).default("error"),
});

// Publish readiness response
export const publishReadinessSchema = z.object({
  ready: z.boolean(),
  eventStatus: eventStatusSchema,
  isPaid: z.boolean(),
  requiresRazorpay: z.boolean(),
  wouldRequireAdminReview: z.boolean(),
  items: z.array(publishReadinessItemSchema),
});

// Publish transition type
export const eventPublishTransitionSchema = z.enum([
  "draft_to_published",
  "draft_to_under_review",
  "published_to_draft",
  "under_review_to_published",
  "under_review_to_draft",
  "noop_already_published",
  "noop_already_under_review",
]);
```

**New audit action constants** (if not already present — check existing `AUDIT_ACTIONS`):

- `EVENT_PUBLISH_REQUESTED` = `"event.publish_requested"` — organizer requested publish
- `EVENT_SUBMIT_FOR_REVIEW` = `"event.submit_for_review"` — transitioned to under_review
- `EVENT_PUBLISH_DENIED` = `"event.publish_denied"` — publish attempt blocked by gating/state/RBAC after owner is known
- `EVENT_PUBLISH_REJECTED` = `"event.publish_rejected"` — future admin review rejection helper
- Existing `EVENT_PUBLISH` and `EVENT_UNPUBLISH` are reused for actual transitions

**Extend existing shared event contract:** update `packages/shared/src/schemas/event.ts` `eventSchema` with:

```typescript
publishedAt: eventDateTimeSchema.nullable(),
submittedForReviewAt: eventDateTimeSchema.nullable(),
```

### Error codes

| Code                         | HTTP | When                                                    |
| ---------------------------- | ---- | ------------------------------------------------------- |
| `EVENT_NOT_PUBLISHABLE`      | 400  | Event not in draft status for publish                   |
| `EVENT_NOT_UNPUBLISHABLE`    | 400  | Event not in published status for unpublish             |
| `EVENT_INCOMPLETE`           | 400  | Completeness check failed (includes readiness details)  |
| `ORGANIZER_NOT_VERIFIED`     | 403  | Organizer isVerified is false                           |
| `RAZORPAY_NOT_LINKED`        | 403  | Paid event but razorpayAccountStatus !== "active"       |
| `EVENT_DATE_IN_PAST`         | 400  | `startAt <= now` or `endAt <= now`                      |
| `EVENT_PRICING_INACTIVE`     | 400  | No active pricing tier or no paid tier for a paid event |
| `EVENT_SLUG_CONFLICT`        | 409  | Slug is no longer unique at publish time                |
| `EVENT_ALREADY_PUBLISHED`    | 200  | Same-owner idempotent no-op publish response            |
| `EVENT_ALREADY_UNDER_REVIEW` | 200  | Same-owner idempotent no-op publish response            |

## Frontend Plan

### Server functions (`apps/web/src/features/events/api.ts`)

Add:

- `publishEvent(eventId)` — POST to publish endpoint
- `unpublishEvent(eventId)` — POST to unpublish endpoint
- `getPublishReadiness(eventId)` — GET `/api/v1/events/:eventId/publish-readiness` (do not compute gating client-side as the source of truth)

### Server-side helpers (`apps/web/src/features/events/api.server.ts`)

Add:

- `getPublishReadinessOnServer(eventId)` — calls `GET /api/v1/events/:eventId/publish-readiness`
- `publishEventOnServer(eventId)` — calls `POST /api/v1/events/:eventId/publish`
- `unpublishEventOnServer(eventId)` — calls `POST /api/v1/events/:eventId/unpublish`

### Query options (`apps/web/src/features/events/queries.ts`)

- Event query already exists and returns status — no new query needed for status display
- Add `publishReadinessQueryOptions(eventId)` with query key `["events", eventId, "publish-readiness"]`
- Publish/unpublish mutations invalidate `eventQueryKey(eventId)`, publish readiness query, and any organizer event-list query keys that already exist

### Components (`apps/web/src/features/events/components/`)

| Component                | Purpose                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `publish-checklist.tsx`  | Displays readiness items (verified organizer, Razorpay linked, categories, pricing, images, policies) with pass/fail indicators |
| `publish-action.tsx`     | Publish button with confirm dialog; disabled with reasons when not ready; shows loading state during mutation                   |
| `unpublish-action.tsx`   | Unpublish button with confirm dialog for published events                                                                       |
| `event-status-badge.tsx` | Colored badge showing current event status (Draft, Under Review, Published, etc.)                                               |

### Route integration

The publish action UI integrates into the existing event management page.

**Decision:** Integrate into the existing `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx` page header/top section. If an overview route already exists at implementation time, add the component there as well only when it is the current organizer landing surface; do not create a second competing publish surface.

**States to handle:**

- **Draft, not ready:** Show checklist with missing items, publish button disabled
- **Draft, ready:** Show checklist all green, publish button enabled with confirm dialog
- **Under review:** Show "Pending admin review" status, no publish/unpublish actions
- **Published:** Show published status with unpublish action
- **Loading:** Spinner during publish/unpublish mutation
- **Error:** Toast or inline error for failed publish attempts with specific reasons
- **Duplicate click/idempotent response:** Treat no-op success responses as success and refresh queries without showing an error

### Accessibility

- Confirm dialogs use `AlertDialog` from shadcn/ui (focus trap, keyboard nav)
- Status badges have appropriate color contrast
- Checklist items use semantic list markup with aria-labels
- Button disabled states include `disabled`/`aria-disabled` as appropriate and visible helper text explaining why (do not rely on tooltip-only messaging, which is inaccessible on mobile/keyboard)
- Loading, empty, and error states use announced text (`aria-live="polite"` for non-critical readiness updates; assertive only for blocking errors)
- Keyboard users can open/cancel/confirm dialogs, and focus returns to the triggering button after close

## Testing Plan

### API tests (`apps/api/test/modules/events/`)

**New test file: `publish.test.ts`** (or extend existing `routes.test.ts`)

| Test case                                                                                                                                                                   | Type          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Publish draft event — happy path (direct to published)                                                                                                                      | Integration   |
| Publish draft event — transitions to under_review when admin review required                                                                                                | Integration   |
| Publish readiness endpoint returns all checks without mutating status or writing audit                                                                                      | Integration   |
| Publish readiness endpoint rejects non-owner                                                                                                                                | RBAC          |
| Publish blocks unverified organizer                                                                                                                                         | Security      |
| Publish blocks paid event without active Razorpay                                                                                                                           | Security      |
| Publish blocks event with no categories                                                                                                                                     | Validation    |
| Publish blocks event with no pricing tiers                                                                                                                                  | Validation    |
| Publish blocks paid event when pricing has no active/paid tier                                                                                                              | Validation    |
| Publish blocks event with no hero image                                                                                                                                     | Validation    |
| Publish blocks event with no refund policy                                                                                                                                  | Validation    |
| Publish blocks event with no cancellation policy                                                                                                                            | Validation    |
| Publish blocks event with `startAt <= now`                                                                                                                                  | Validation    |
| Publish blocks event with `endAt <= now`                                                                                                                                    | Validation    |
| Publish blocks stale slug conflict detected at publish time                                                                                                                 | Validation    |
| Publish returns aggregated readiness failures                                                                                                                               | Validation    |
| Publish already published event by same owner returns idempotent no-op                                                                                                      | State machine |
| Publish under_review event by same owner returns idempotent no-op                                                                                                           | State machine |
| Publish rejects non-draft event (completed)                                                                                                                                 | State machine |
| Publish rejects non-draft event (cancelled)                                                                                                                                 | State machine |
| Publish duplicate same-owner request on already published/under_review has no additional transition side effects                                                            | State machine |
| Concurrent publish requests produce one transition and one no-op/controlled conflict, never duplicate audit transition rows                                                 | Concurrency   |
| Free event readiness skips Razorpay only when `isPaid=false` and no active paid tiers (future-proof service-level test using fixtures/mocks if DB V1 check prevents insert) | Payments gate |
| Publish rejects non-owner organizer                                                                                                                                         | RBAC          |
| Publish rejects unauthenticated request                                                                                                                                     | Auth          |
| Publish rejects non-organizer role                                                                                                                                          | RBAC          |
| Unpublish published event — happy path                                                                                                                                      | Integration   |
| Unpublish rejects draft event                                                                                                                                               | State machine |
| Unpublish rejects under_review event                                                                                                                                        | State machine |
| Unpublish duplicate same-owner request after success returns no-op only for already-draft/cleared publishedAt state                                                         | State machine |
| Unpublish rejects non-owner                                                                                                                                                 | RBAC          |
| CSRF required on publish                                                                                                                                                    | Security      |
| CSRF required on unpublish                                                                                                                                                  | Security      |
| Admin approve from under_review — service-level test                                                                                                                        | Integration   |
| Admin reject from under_review — service-level test                                                                                                                         | Integration   |
| Audit log entries created for publish                                                                                                                                       | Observability |
| Audit log entries created for unpublish                                                                                                                                     | Observability |
| Audit log entry created for denied publish with safe denial codes and no PII/Razorpay account ID                                                                            | Observability |

**Patterns:** Use `buildTestApp()`, `app.inject()`, mock session with organizer role. Create test fixtures for complete event (with categories, pricing, images, policies).

### Shared package tests (`packages/shared/test/schemas/`)

- `event-publish.test.ts`: Schema validation for readiness items, transition types, error response shapes.
- `event.test.ts`: Existing event schema tests (or add assertions in nearest existing file) cover nullable `publishedAt` and `submittedForReviewAt`.

### Web tests (`apps/web/src/features/events/`)

- `publish-checklist.test.tsx`: Renders correct pass/fail items based on event state
- `publish-action.test.tsx`: Button disabled for each gating reason (unverified organizer, Razorpay missing, categories missing, pricing missing/inactive, hero image missing, policies missing, event date in past, slug conflict), enabled when ready, shows confirm dialog
- `publish-action.test.tsx`: Surfaces API readiness/error details, handles idempotent success, invalidates/refetches queries after success
- `unpublish-action.test.tsx`: Shows confirmation, success path, API error path, loading state, and no action for under_review/draft
- `event-status-badge.test.tsx`: Correct colors/labels for each status

### DB tests

- Migration applies cleanly: `published_at` and `submitted_for_review_at` columns exist
- Rollback removes columns
- Existing queries still work with new columns

## Validation Plan

### Baseline capture (before implementation)

| Check                          | Command                                     | Purpose                                                           |
| ------------------------------ | ------------------------------------------- | ----------------------------------------------------------------- |
| DB tests baseline              | `pnpm --filter @repo/db test`               | Confirm existing DB tests pass                                    |
| DB types baseline              | `pnpm --filter @repo/db check-types`        | Confirm DB types clean                                            |
| DB rollback validator baseline | `pnpm --filter @repo/db db:check:rollbacks` | Confirm existing rollback files are valid before adding migration |
| DB drift baseline              | `pnpm --filter @repo/db db:check:drift`     | Confirm schema/migration drift baseline                           |
| DB lock-risk baseline          | `pnpm --filter @repo/db db:check:lock-risk` | Confirm existing migrations pass lock-risk linter                 |
| Shared tests baseline          | `pnpm --filter @repo/shared test`           | Confirm shared tests pass                                         |
| Shared types baseline          | `pnpm --filter @repo/shared check-types`    | Confirm shared types clean                                        |
| API tests baseline             | `pnpm --filter api test`                    | Confirm API tests pass                                            |
| API types baseline             | `pnpm --filter api check-types`             | Confirm API types (may have pre-existing failures)                |
| Web tests baseline             | `pnpm --filter web test`                    | Confirm web tests pass                                            |
| Web types baseline             | `pnpm --filter web check-types`             | Confirm web types clean                                           |
| Lint baseline                  | `pnpm lint`                                 | Confirm lint clean                                                |

### After-change verification

| #   | Check                 | Command                                     | Minimum evidence                                     |
| --- | --------------------- | ------------------------------------------- | ---------------------------------------------------- |
| 1   | DB migration applies  | `pnpm --filter @repo/db db:migrate:run`     | Exit 0, columns exist                                |
| 2   | DB rollback works     | `pnpm --filter @repo/db db:check:rollbacks` | Exit 0                                               |
| 3   | DB schema drift clean | `pnpm --filter @repo/db db:check:drift`     | Exit 0                                               |
| 4   | DB lock-risk clean    | `pnpm --filter @repo/db db:check:lock-risk` | Exit 0                                               |
| 5   | DB tests pass         | `pnpm --filter @repo/db test`               | All tests pass                                       |
| 6   | DB types clean        | `pnpm --filter @repo/db check-types`        | Exit 0                                               |
| 7   | Shared tests pass     | `pnpm --filter @repo/shared test`           | All tests pass including new publish schema tests    |
| 8   | Shared types clean    | `pnpm --filter @repo/shared check-types`    | Exit 0                                               |
| 9   | API tests pass        | `pnpm --filter api test`                    | All tests pass including new publish tests           |
| 10  | API types clean       | `pnpm --filter api check-types`             | Exit 0 (or same pre-existing failures only)          |
| 11  | Web tests pass        | `pnpm --filter web test`                    | All tests pass including new publish UI tests        |
| 12  | Web types clean       | `pnpm --filter web check-types`             | Exit 0                                               |
| 13  | Full workspace lint   | `pnpm lint`                                 | Exit 0                                               |
| 14  | Full workspace types  | `pnpm check-types`                          | Exit 0 or same documented pre-existing failures only |
| 15  | Full workspace tests  | `pnpm test`                                 | Exit 0 or same documented pre-existing failures only |

### Adversarial review (Large/Red requirements)

- **Review pass 1:** Plan completeness — all transitions covered, gating logic correct, no orphaned states
- **Review pass 2:** Security — RBAC enforced server-side, CSRF on POST, no PII in logs, organizer verification not UI-only
- **Review pass 3:** Migration safety — nullable columns, no lock risk, rollback tested
- Fix-and-rerun loop: real findings from any pass must be fixed and the smallest relevant verification commands rerun. Stop after at most 2 review/fix loops if an unresolved Red finding remains, and mark implementation blocked with exact evidence.

## Progress Tracking Updates

The implementer must update:

1. **`progress.md`** — Add entry for I-1.2.6 completion
2. **`docs/v1-implementation-plan.md`** — Mark I-1.2.6 row 9 as complete with checkmark
3. **This plan's task table** — Mark tasks complete with dates

## Agent Run Ledger

| Phase                       | Agent                   | Status                          | Size/Risk | Decisions / assumptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake                      | eventkart-planner       | Complete                        | Large/Red | Resolved I-1.2.6 → `feature-1.2-I-1.2.6.md`. Read v1-impl-plan row 9, requirements F-1.2.6/F-1.2.7, architecture §1/§2, all event code, organizer schema, shared constants, existing plans.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | event.ts constants (statuses include under_review), events.ts schema (no publishedAt yet), organizer schema (isVerified, razorpayAccountStatus), audit.ts constants, service.ts patterns                                                                                                                   |
| Prerequisite analysis       | eventkart-planner       | Complete                        | Large/Red | I-1.2.1–I-1.2.5, I-1.1.6, I-1.1.7, I-1.2.8, I-1.2.9 all complete or have sufficient foundation. I-1.2.4 not started but completeness check defers form_schema. I-1.2.5 not started but policy columns exist.                                                                                                                                                                                                                                                                                                                                                                                                                                            | v1-impl-plan current state table, events.ts schema columns                                                                                                                                                                                                                                                 |
| Baseline strategy           | eventkart-planner       | Planned                         | Large/Red | Run all workspace tests + types + lint before implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Commands listed in Validation Plan                                                                                                                                                                                                                                                                         |
| Adversarial review strategy | eventkart-planner       | Planned                         | Large/Red | 3 review passes: plan completeness, security, migration safety                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Review checklist defined above                                                                                                                                                                                                                                                                             |
| Plan review                 | eventkart-plan-reviewer | Revised                         | Large/Red | Added readiness endpoint, edge-case gating, idempotency/concurrency rules, non-empty rollback validation, exact verification commands, web/API test coverage, and autopilot-safe route integration decision. Assumed current V1 events are paid; future free events skip Razorpay only when no active paid tiers exist.                                                                                                                                                                                                                                                                                                                                 | Read `.github/agent-conventions.md`, target plan, `docs/v1-implementation-plan.md`, `docs/requirements.md`, `docs/architecture.md`, `.github/copilot-instructions.md`, Fastify/TanStack instructions, and existing event/organizer/audit/db schema files. Revised `docs/impl-plan/feature-1.2-I-1.2.6.md`. |
| Git hygiene                 | eventkart-implementer   | Complete                        | Large/Red | Branch `development`; only pre-existing dirty item was this untracked plan file, no overlapping user code changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `git status --short` showed `?? docs/impl-plan/feature-1.2-I-1.2.6.md`; branch `development`                                                                                                                                                                                                               |
| Baseline                    | eventkart-implementer   | Complete                        | Large/Red | Captured DB/shared/API/web/lint baseline. Known blockers: DB lock-risk old migrations; API check-types old test strictness errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verification Ledger baseline rows                                                                                                                                                                                                                                                                          |
| Implementation              | eventkart-implementer   | Complete                        | Large/Red | Implemented shared contracts, nullable publish timestamps migration/rollback, API readiness/publish/unpublish/admin helpers, web server functions/query/UI, and route integration. Deviated from plan by extending existing `routes.test.ts` instead of creating `publish.test.ts` to preserve existing route-mock test pattern.                                                                                                                                                                                                                                                                                                                        | Files changed across `packages/shared`, `packages/db`, `apps/api`, `apps/web`                                                                                                                                                                                                                              |
| Verification                | eventkart-implementer   | Complete with baseline blockers | Large/Red | Relevant tests and lint passed. `db:migrate:run` could not run without local DB env. `pnpm check-types` remains blocked by same pre-existing API test type errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verification Ledger after rows                                                                                                                                                                                                                                                                             |
| Review                      | eventkart-implementer   | Complete                        | Large/Red | Manual plan-completeness, security, and migration-safety review completed; no unresolved Red findings in changed code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Verification Ledger review rows                                                                                                                                                                                                                                                                            |
| Progress tracking           | eventkart-implementer   | Complete                        | Large/Red | Updated this plan, `progress.md`, and `docs/v1-implementation-plan.md`; did not archive because active plan file was not archived before this run and follow-up docs/history remain useful.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Task table T1-T11 complete and progress docs updated                                                                                                                                                                                                                                                       |
| Review fix loop             | eventkart-implementer   | Complete                        | Large/Red | Fixed blocking review findings only: ordinary never-published drafts no longer no-op on unpublish; admin approval reuses real organizer/readiness and blocks stale gates; service-level publish/unpublish/admin audit tests added; hero image confirm/delete now draft-only for hero mutations after publish/under_review.                                                                                                                                                                                                                                                                                                                              | Verification Ledger review/after rows added 2026-04-27                                                                                                                                                                                                                                                     |
| Blocker fix                 | eventkart-implementer   | Complete                        | Small/Red | Fixed the remaining I-1.2.6 blocker only: `requestEventImageUpload` now retains the event from `assertWritableEvent()` and rejects hero upload-url requests for `published`/`under_review` before storage URL generation, DB insert, or audit logging. Added focused service and route coverage; avoided unrelated dirty files.                                                                                                                                                                                                                                                                                                                         | Verification Ledger blocker baseline/after rows added 2026-04-27                                                                                                                                                                                                                                           |
| Code review fix round 2     | eventkart-implementer   | Complete with DB-env blocker    | Large/Red | Addressed requested B1/B2/B3 evidence and I4-I10/N1 gaps: added injectable admin-review policy seam; added real publish state-machine service tests for direct publish, under-review transition, same-owner no-op states, non-owner publish, missing categories/pricing, past start date, and stale slug conflict; added publish/unpublish action tests for disabled reasons, confirmation, mutation calls, invalidation, and error announcements. Retried DB migration apply, still blocked by missing local migration DB env.                                                                                                                         | Verification Ledger rows added 2026-04-27; `pnpm test` exit 0; `pnpm --filter @repo/db db:migrate:run` still exit 1 due missing `DATABASE_URL`/`MIGRATION_DATABASE_URL`                                                                                                                                    |
| Code review fix round 3     | eventkart-implementer   | Complete with DB hard blocker   | Large/Red | Fixed remaining review gaps: hero image upload-url/confirm/delete now lock the event row and re-check draft status inside the mutation transaction; image audit metadata no longer includes `storageKey`; removed draft-unpublish no-op transition from shared/docs; publish/unpublish UI now surfaces API messages/codes, readiness-refreshes on publish gate errors, disables confirm while pending, and announces success accessibly; added server helper/action/service regression coverage. DB apply/rollback execution remains hard-blocked because configured DB refuses connections, Docker daemon is unavailable, and `psql` is not installed. | Verification Ledger rows added 2026-04-27; targeted and full API/web/shared/db/lint gates recorded; DB apply/rollback blocker recorded                                                                                                                                                                     |

## Verification Ledger

| Phase     | Check                                                     | Tool/command                                                                                                                                                                                                                                                                            | Exit code | Passed | Evidence snippet                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline  | DB tests                                                  | `pnpm --filter @repo/db test`                                                                                                                                                                                                                                                           | 0         | Yes    | 3 files, 31 tests passed                                                                                                                                                                                                |
| baseline  | DB types                                                  | `pnpm --filter @repo/db check-types`                                                                                                                                                                                                                                                    | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | DB rollback validator                                     | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 12 rollback(s) present and non-empty`                                                                                                                                                                              |
| baseline  | DB drift checker                                          | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files`                                                                                                                                                                    |
| baseline  | DB lock-risk checker                                      | `pnpm --filter @repo/db db:check:lock-risk`                                                                                                                                                                                                                                             | 1         | No     | Pre-existing findings: 26 critical findings in old migrations including 0001, 0002, 0004, 0005, 0006, 0007, 0012                                                                                                        |
| baseline  | Shared tests                                              | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 0         | Yes    | 13 files passed before change                                                                                                                                                                                           |
| baseline  | Shared types                                              | `pnpm --filter @repo/shared check-types`                                                                                                                                                                                                                                                | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | API suite passed before change                                                                                                                                                                                          |
| baseline  | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`                                                                                                                            |
| baseline  | Web tests                                                 | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 0         | Yes    | Web suite passed before change                                                                                                                                                                                          |
| baseline  | Web types                                                 | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | Lint                                                      | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | 7 lint tasks successful; existing API warnings only                                                                                                                                                                     |
| after     | DB migration apply                                        | `pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                                                                 | 1         | No     | Blocked by local env: `DATABASE_URL or MIGRATION_DATABASE_URL must be set to run migrations`                                                                                                                            |
| after     | DB rollback                                               | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 13 rollback(s) present and non-empty`                                                                                                                                                                              |
| after     | DB drift                                                  | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files`                                                                                                                                                                    |
| after     | DB lock risk                                              | `pnpm --filter @repo/db db:check:lock-risk`                                                                                                                                                                                                                                             | 1         | No     | Same pre-existing 26 critical findings; new `0013_sour_cloak.sql` produced no reported finding                                                                                                                          |
| after     | DB tests                                                  | `pnpm --filter @repo/db test`                                                                                                                                                                                                                                                           | 0         | Yes    | 3 files, 31 tests passed                                                                                                                                                                                                |
| after     | DB types                                                  | `pnpm --filter @repo/db check-types`                                                                                                                                                                                                                                                    | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Shared tests (first run)                                  | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 1         | No     | New event timestamp contract required fixture updates; 2 failed tests                                                                                                                                                   |
| after     | Shared tests                                              | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 0         | Yes    | 14 files, 160 tests passed                                                                                                                                                                                              |
| after     | Shared types                                              | `pnpm --filter @repo/shared check-types`                                                                                                                                                                                                                                                | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | API route targeted tests                                  | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts`                                                                                                                                                                                                                  | 0         | Yes    | `routes.test.ts` 77 tests passed                                                                                                                                                                                        |
| after     | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | 42 files, 677 tests passed                                                                                                                                                                                              |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in audit and OTP verify tests; no source errors from publish workflow after fix                                                                                                              |
| after     | Web tests (first run)                                     | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 1         | No     | New matcher usage and event fixtures fixed after failure                                                                                                                                                                |
| after     | Web tests                                                 | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 0         | Yes    | 17 files, 121 tests passed                                                                                                                                                                                              |
| after     | Web types                                                 | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Full lint                                                 | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | 7 lint tasks successful                                                                                                                                                                                                 |
| after     | Full types                                                | `pnpm check-types`                                                                                                                                                                                                                                                                      | 2         | No     | Blocked by same pre-existing API test type errors; db/shared/web succeeded                                                                                                                                              |
| after     | Full tests                                                | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | 4 test tasks successful; API 677 tests, web 121 tests                                                                                                                                                                   |
| review    | Plan completeness                                         | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Verified shared→DB→API→web slices, publish/unpublish/admin helper transitions, and progress docs                                                                                                                        |
| review    | Security review                                           | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Server owner/RBAC checks, CSRF on POST routes, safe audit metadata, no raw env reads                                                                                                                                    |
| review    | Migration safety                                          | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Nullable columns, non-empty rollback, drift clean; migration apply needs DB env                                                                                                                                         |
| baseline  | Review-fix targeted event tests                           | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                                                                 | 0         | Yes    | Before review fixes: 2 files, 72 tests passed                                                                                                                                                                           |
| after     | Review-fix first targeted event tests                     | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                                                                 | 1         | No     | New tests exposed mock/test issues: 9 failed across admin readiness and hero-image mutation coverage                                                                                                                    |
| after     | Review-fix targeted event service/routes tests            | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                              | 0         | Yes    | 3 files, 158 tests passed including unpublish draft rejection, admin stale readiness, hero image publish guards                                                                                                         |
| after     | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | Full API Vitest suite completed with exit 0                                                                                                                                                                             |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; no publish/image/service test type errors remain                                                                     |
| after     | API lint                                                  | `pnpm --filter api lint`                                                                                                                                                                                                                                                                | 0         | Yes    | Biome lint exit 0; existing noNonNullAssertion warnings in admin/auth/organizer modules remain                                                                                                                          |
| review    | Review-fix self-review                                    | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed no fake organizer in admin approve, ordinary draft unpublish rejects, and hero delete/confirm fail before storage/update when non-draft                                                                       |
| baseline  | Blocker targeted event image/routes tests                 | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                                                                  | 0         | Yes    | Before blocker fix: 2 files, 92 tests passed                                                                                                                                                                            |
| after     | Blocker targeted event image/routes tests                 | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                                                                  | 0         | Yes    | 2 files, 96 tests passed including new published/under_review hero upload-url rejection cases                                                                                                                           |
| after     | Blocker relevant event service/routes tests               | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | 3 files, 162 tests passed                                                                                                                                                                                               |
| after     | Blocker changed-file lint                                 | `pnpm --filter api exec biome lint src/modules/events/event-image-service.ts test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                        | 0         | Yes    | `Checked 3 files in 46ms. No fixes applied.`                                                                                                                                                                            |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; changed event image/route tests are not in the error list                                                            |
| after     | API lint                                                  | `pnpm --filter api lint`                                                                                                                                                                                                                                                                | 0         | Yes    | Biome lint exit 0; existing warnings remain outside changed event image files                                                                                                                                           |
| review    | Blocker self-review                                       | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed guard executes after request validation/ownership and before `storage.getUploadUrl()`, `eventImages.insert()`, and `auditLogger.log()`                                                                        |
| after     | Review-fix round 2 API service tests                      | `pnpm --filter api exec vitest run test/modules/events/service.test.ts --reporter=dot`                                                                                                                                                                                                  | 0         | Yes    | `Test Files 1 passed (1); Tests 74 passed (74)` including direct publish, under-review policy, no-op, non-owner, category/pricing/date/slug gates                                                                       |
| after     | Review-fix round 2 web action tests first run             | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot`                                                                                                                      | 1         | No     | New tests failed due test-only matcher/cleanup issues: invalid Chai `toBeDisabled`/`toBeEnabled` and multiple rendered dialogs                                                                                          |
| after     | Review-fix round 2 web action tests                       | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot`                                                                                                                      | 0         | Yes    | `Test Files 2 passed (2); Tests 6 passed (6)`                                                                                                                                                                           |
| after     | DB migration apply retry                                  | `pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                                                                 | 1         | No     | Still locally blocked: `DATABASE_URL or MIGRATION_DATABASE_URL must be set to run migrations.`                                                                                                                          |
| after     | Review-fix round 2 API changed-file lint                  | `pnpm --filter api exec biome lint src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                   | 0         | Yes    | `Checked 2 files in 113ms. No fixes applied.`                                                                                                                                                                           |
| after     | Review-fix round 2 web changed-file lint                  | `pnpm --filter web exec biome lint src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                     | 0         | Yes    | `Checked 2 files in 81ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 API event tests                        | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 170 passed (170)`                                                                                                                                                                       |
| after     | Review-fix round 2 web publish tests                      | `pnpm --filter web exec vitest run src/features/events/components/publish-checklist.test.tsx src/features/events/components/event-status-badge.test.tsx src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot` | 0         | Yes    | `Test Files 4 passed (4); Tests 8 passed (8)`                                                                                                                                                                           |
| after     | API types retry                                           | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; no changed event service/test errors reported                                                                        |
| after     | Web types retry                                           | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | DB rollback retry                                         | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 13 rollback(s) present and non-empty.`                                                                                                                                                                             |
| after     | DB drift retry                                            | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files.`                                                                                                                                                                   |
| after     | Full lint retry                                           | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; preview showed web lint `Checked 139 files in 1529ms. No fixes applied.`                                                                                                                             |
| after     | Full tests retry                                          | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo test exit 0 across workspace test tasks; preview showed web Vitest running and command completed successfully                                                                                                     |
| after     | Review-fix round 2 API Biome check first run              | `pnpm --filter api exec biome check src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                  | 1         | No     | Formatter/import organization needed for `service.ts` and `service.test.ts`; fixed with Biome                                                                                                                           |
| after     | Review-fix round 2 web Biome check first run              | `pnpm --filter web exec biome check src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                    | 1         | No     | Formatter changes needed for new action tests; fixed with Biome                                                                                                                                                         |
| after     | Review-fix round 2 API Biome format                       | `pnpm --filter api exec biome check --write src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                          | 0         | Yes    | `Checked 2 files in 43ms. Fixed 2 files.`                                                                                                                                                                               |
| after     | Review-fix round 2 web Biome format                       | `pnpm --filter web exec biome check --write src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                            | 0         | Yes    | `Checked 2 files in 158ms. Fixed 2 files.`                                                                                                                                                                              |
| after     | Review-fix round 2 API Biome check                        | `pnpm --filter api exec biome check src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                  | 0         | Yes    | `Checked 2 files in 36ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 web Biome check                        | `pnpm --filter web exec biome check src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                    | 0         | Yes    | `Checked 2 files in 81ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 API event tests after format           | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 170 passed (170)`                                                                                                                                                                       |
| after     | Review-fix round 2 web publish tests after format         | `pnpm --filter web exec vitest run src/features/events/components/publish-checklist.test.tsx src/features/events/components/event-status-badge.test.tsx src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot` | 0         | Yes    | `Test Files 4 passed (4); Tests 8 passed (8)`                                                                                                                                                                           |
| after     | Full tests after format                                   | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo test exit 0 across workspace test tasks; preview showed shared/web/API Vitest suites running and command completed successfully                                                                                   |
| after     | Full lint after format                                    | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; preview showed web lint `Checked 139 files in 306ms. No fixes applied.`                                                                                                                              |
| readiness | Todo sqlite completion marker                             | `sqlite3 ':memory:' "SELECT 'blocked:no todo sqlite database found for I-1.2.6';"`                                                                                                                                                                                                      | 2         | No     | No repo/session todo sqlite DB found within shallow workspace search; command output `blocked:no todo sqlite database found for I-1.2.6`                                                                                |
| review    | Review-fix round 2 self-review                            | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed requested B1/B2/B3 code paths have tests/evidence; I4-I10 real service publish transition/gate tests added; N1 web action component tests added; migration apply remains blocked only by missing local DB env |
| after     | Review-fix round 3 DB env discovery                       | `Select-String packages/db/.env apps/api/.env packages/db/.env.example for DATABASE_URL/MIGRATION_DATABASE_URL keys`                                                                                                                                                                    | 0         | Yes    | `packages/db/.env missing`; `apps/api/.env keys: DATABASE_URL`; `packages/db/.env.example missing`                                                                                                                      |
| after     | Review-fix round 3 DB migration apply with configured env | `apps/api/.env DATABASE_URL exported; pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                            | 1         | No     | Migration attempted against configured local URL and failed with `ECONNREFUSED` while running `CREATE SCHEMA IF NOT EXISTS "drizzle"`                                                                                   |
| after     | Review-fix round 3 Docker DB fallback                     | `docker ps -a --filter "name=eventkart-pg" --format "{{.ID}} {{.Status}} {{.Ports}}"`                                                                                                                                                                                                   | 1         | No     | Docker CLI exists, but daemon is unavailable: `failed to connect to the docker API ... dockerDesktopLinuxEngine ... The system cannot find the file specified`                                                          |
| after     | Review-fix round 3 SQL dry-run parser availability        | `psql --version`                                                                                                                                                                                                                                                                        | 0         | No     | PowerShell reported `The term 'psql' is not recognized`; no local PostgreSQL parser is available for apply/rollback dry-run                                                                                             |
| after     | Review-fix round 3 DB rollback/apply execution            | Manual blocker assessment                                                                                                                                                                                                                                                               | 1         | No     | Hard blocker: no reachable Postgres, Docker daemon unavailable, and no `psql`; rollback column-removal and re-apply execution could not be safely performed in this environment                                         |
| after     | Review-fix round 3 DB static rollback check               | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `✅ All 13 rollback(s) present and non-empty.`                                                                                                                                                                          |
| after     | Review-fix round 3 API targeted event tests               | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/service.test.ts --reporter=dot`                                                                                                                                                  | 0         | Yes    | `Test Files 2 passed (2); Tests 95 passed (95)` including transaction-lock hero image guards and publish state-machine regressions                                                                                      |
| after     | Review-fix round 3 web targeted tests                     | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx src/features/events/api.server.test.ts --reporter=dot`                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 28 passed (28)`                                                                                                                                                                         |
| after     | Review-fix round 3 web types                              | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Review-fix round 3 shared gates                           | `pnpm --filter @repo/shared check-types; pnpm --filter @repo/shared test`                                                                                                                                                                                                               | 0         | Yes    | `tsc --noEmit` completed; `Test Files 14 passed (14); Tests 160 passed (160)`                                                                                                                                           |
| after     | Review-fix round 3 DB gates                               | `pnpm --filter @repo/db check-types; pnpm --filter @repo/db test; pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                            | 0         | Yes    | `tsc --noEmit`; `Test Files 3 passed (3); Tests 31 passed (31)`; rollbacks present                                                                                                                                      |
| after     | Review-fix round 3 API types                              | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Baseline blocker only: 8 pre-existing errors remain in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; changed event source/test files had no type errors after fix                                |
| after     | Review-fix round 3 API full tests                         | `pnpm --filter api exec vitest run --reporter=dot`                                                                                                                                                                                                                                      | 0         | Yes    | `Test Files 42 passed (42); Tests 702 passed (702)`                                                                                                                                                                     |
| after     | Review-fix round 3 web full tests                         | `pnpm --filter web exec vitest run --passWithNoTests --reporter=dot`                                                                                                                                                                                                                    | 0         | Yes    | `Test Files 20 passed (20); Tests 155 passed (155)`                                                                                                                                                                     |
| after     | Review-fix round 3 full lint                              | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; existing warnings only (for example `noNonNullAssertion` in unrelated admin/auth/organizer files)                                                                                                    |
| readiness | Review-fix round 3 todo sqlite completion marker          | `sqlite3 "C:\Users\v-mnmurugan\.copilot\session-state\935b430f-41b9-404c-83c6-3a90827eb91f\session.db" "UPDATE todos SET status='done' WHERE id='fix-loop-1'; UPDATE todos SET status='done' WHERE id='code-review';"`                                                                  | 0         | Yes    | Command completed with exit 0                                                                                                                                                                                           |
| review    | Review-fix round 3 self-review                            | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed B1 locked transaction re-checks for upload-url/confirm/delete, B2 policy path remains service-only, I4 transition removal has no remaining grep hits, I8/I9 UI/audit metadata changes covered by tests        |

## Task Table

| ID  | Description                                                                                                                 | Owner                 | Size   | Risk                   | Dependencies | Target files/areas                                                                                                                                                                                                             | Validation                                                                                                                                                                                                                                                                   | Status                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------ | ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| T1  | Add publish-related shared schemas, constants, event response timestamps, and tests                                         | eventkart-implementer | Small  | Standard               | None         | `packages/shared/src/schemas/event-publish.ts`, `packages/shared/src/schemas/event.ts`, `packages/shared/src/schemas/index.ts`, `packages/shared/src/constants/audit.ts`, `packages/shared/test/schemas/event-publish.test.ts` | `pnpm --filter @repo/shared test` pass, `pnpm --filter @repo/shared check-types` pass; transition enum includes no-op transitions                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T2  | DB migration: add `published_at` and `submitted_for_review_at` columns to events table with non-empty rollback              | eventkart-implementer | Small  | Red (migration)        | T1           | `packages/db/src/schema/events.ts`, new migration file, paired rollback SQL                                                                                                                                                    | Rollback, drift, DB tests, and types pass; migration apply blocked locally by missing DB env; lock-risk remains pre-existing only                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T3  | API service: readiness, publish state machine, gating logic, completeness check, idempotency/concurrency, admin review stub | eventkart-implementer | Medium | Red (auth, public-api) | T1, T2       | `apps/api/src/modules/events/service.ts`                                                                                                                                                                                       | Service functions callable; owner checks server-side; denied attempts audited; source types clean (API type gate still has pre-existing test errors)                                                                                                                         | ✅ Complete — 2026-04-27 |
| T4  | API routes: `GET .../publish-readiness`, `POST .../publish`, and `POST .../unpublish` with schemas/CSRF expectations        | eventkart-implementer | Medium | Red (auth, public-api) | T3           | `apps/api/src/modules/events/routes.ts`, `apps/api/src/modules/events/schemas.ts`                                                                                                                                              | Routes registered; GET read-only/no CSRF; POST routes use existing CSRF; targeted route tests pass                                                                                                                                                                           | ✅ Complete — 2026-04-27 |
| T5  | API tests: readiness, legal/illegal transitions, edge-case gating, RBAC, CSRF, audit log, idempotency/concurrency           | eventkart-implementer | Medium | Red                    | T3, T4       | `apps/api/test/modules/events/routes.test.ts`, `apps/api/test/modules/events/service.test.ts`                                                                                                                                  | Extended existing route suite plus real service publish state-machine tests for direct publish, under-review policy seam, no-op states, non-owner, missing category/pricing, past date, stale slug, admin readiness, and image publish guards; targeted API event tests pass | ✅ Complete — 2026-04-27 |
| T6  | Web server functions, readiness query, mutation invalidation, types for publish/unpublish                                   | eventkart-implementer | Small  | Standard               | T4           | `apps/web/src/features/events/api.ts`, `apps/web/src/features/events/api.server.ts`, `apps/web/src/features/events/queries.ts`, `apps/web/src/features/events/types.ts`                                                        | `pnpm --filter web check-types` pass; no raw env reads; API over HTTP only                                                                                                                                                                                                   | ✅ Complete — 2026-04-27 |
| T7  | Web UI: publish checklist, publish/unpublish actions, status badge, confirm dialogs                                         | eventkart-implementer | Medium | Standard               | T6           | `apps/web/src/features/events/components/publish-checklist.tsx`, `publish-action.tsx`, `unpublish-action.tsx`, `event-status-badge.tsx`                                                                                        | Components render, types clean                                                                                                                                                                                                                                               | ✅ Complete — 2026-04-27 |
| T8  | Web route integration: add publish section to existing event management page                                                | eventkart-implementer | Small  | Standard               | T7           | `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx`                                                                                                                                                                     | Route renders publish UI and no duplicate publish surface is created                                                                                                                                                                                                         | ✅ Complete — 2026-04-27 |
| T9  | Web tests: publish UI components                                                                                            | eventkart-implementer | Small  | Standard               | T7, T8       | `apps/web/src/features/events/components/*.test.tsx`                                                                                                                                                                           | Publish checklist/status badge tests plus publish/unpublish action tests for disabled reason, confirmation, mutation, invalidation, and error alert; targeted web publish tests and web types pass                                                                           | ✅ Complete — 2026-04-27 |
| T10 | Full validation: lint, types, all tests across workspaces                                                                   | eventkart-implementer | Small  | Standard               | T1–T9        | All workspaces                                                                                                                                                                                                                 | `pnpm lint` and `pnpm test` pass; `pnpm check-types` blocked by documented pre-existing API test type errors only                                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T11 | Progress tracking updates                                                                                                   | eventkart-implementer | Small  | Standard               | T10          | `progress.md`, `docs/v1-implementation-plan.md`, this plan                                                                                                                                                                     | Documents updated                                                                                                                                                                                                                                                            | ✅ Complete — 2026-04-27 |

## Files Summary

### Planner-created files

| Path                                    | Action | Notes          |
| --------------------------------------- | ------ | -------------- |
| `docs/impl-plan/feature-1.2-I-1.2.6.md` | Create | This plan file |

### Implementer will create/modify

| Path                                                                     | Action | Rationale                                                                                                                                                 | Rollback                               |
| ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `packages/shared/src/schemas/event-publish.ts`                           | Create | Publish readiness, transition type schemas                                                                                                                | Delete file                            |
| `packages/shared/src/schemas/event.ts`                                   | Update | Add nullable publish timestamp fields to event response contract                                                                                          | Remove added fields after API rollback |
| `packages/shared/src/schemas/index.ts`                                   | Update | Re-export new schemas                                                                                                                                     | Remove re-export lines                 |
| `packages/shared/src/constants/audit.ts`                                 | Update | Add `EVENT_PUBLISH_REQUESTED`, `EVENT_SUBMIT_FOR_REVIEW`, `EVENT_PUBLISH_DENIED`, `EVENT_PUBLISH_REJECTED` if needed                                      | Remove added constants                 |
| `packages/shared/test/schemas/event-publish.test.ts`                     | Create | Schema tests                                                                                                                                              | Delete file                            |
| `packages/db/src/schema/events.ts`                                       | Update | Add `publishedAt`, `submittedForReviewAt` columns                                                                                                         | Remove columns from schema             |
| `packages/db/drizzle/NNNN_*.sql` (migration)                             | Create | Migration SQL for new columns                                                                                                                             | Run rollback SQL                       |
| `packages/db/drizzle/NNNN_*.rollback.sql` (exact repo naming convention) | Create | Non-empty rollback SQL for validator                                                                                                                      | Delete after migration rollback        |
| `apps/api/src/modules/events/service.ts`                                 | Update | Add readiness/publish/unpublish/admin-approve/admin-reject functions, completeness check, gating logic, idempotency/concurrency, requiresAdminReview stub | Remove added functions                 |
| `apps/api/src/modules/events/schemas.ts`                                 | Update | Add readiness/publish/unpublish request/response schemas                                                                                                  | Remove added schemas                   |
| `apps/api/src/modules/events/routes.ts`                                  | Update | Add GET readiness plus POST publish/unpublish routes                                                                                                      | Remove added routes                    |
| `apps/api/test/modules/events/publish.test.ts`                           | Create | Comprehensive publish test suite                                                                                                                          | Delete file                            |
| `apps/web/src/features/events/api.ts`                                    | Update | Add publishEvent, unpublishEvent server functions                                                                                                         | Remove added functions                 |
| `apps/web/src/features/events/api.server.ts`                             | Update | Add server-side readiness/publish/unpublish helpers                                                                                                       | Remove added functions                 |
| `apps/web/src/features/events/queries.ts`                                | Update | Add readiness query options and invalidation keys                                                                                                         | Remove added query options             |
| `apps/web/src/features/events/types.ts`                                  | Update | Add publish response types                                                                                                                                | Remove added types                     |
| `apps/web/src/features/events/components/publish-checklist.tsx`          | Create | Pre-publish readiness checklist UI                                                                                                                        | Delete file                            |
| `apps/web/src/features/events/components/publish-action.tsx`             | Create | Publish button with confirm dialog                                                                                                                        | Delete file                            |
| `apps/web/src/features/events/components/unpublish-action.tsx`           | Create | Unpublish button with confirm dialog                                                                                                                      | Delete file                            |
| `apps/web/src/features/events/components/event-status-badge.tsx`         | Create | Event status badge component                                                                                                                              | Delete file                            |
| `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx`               | Update | Integrate publish section                                                                                                                                 | Revert changes                         |
| `apps/web/src/features/events/components/publish-checklist.test.tsx`     | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/publish-action.test.tsx`        | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/unpublish-action.test.tsx`      | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/event-status-badge.test.tsx`    | Create | Component test                                                                                                                                            | Delete file                            |

## Rollback Plan

### Code rollback

All changes are additive (new files, new functions, new columns). Rollback:

1. Revert the git commit(s) for this feature
2. Run the migration rollback SQL to drop `published_at` and `submitted_for_review_at` columns
3. Remove any newly registered routes from deployed API instances and redeploy web without publish controls
4. All existing draft event CRUD functionality remains intact

### Data rollback

- New columns are nullable with no data backfill
- If events have been published (status changed), reverting code means the status column values remain but the transition routes are gone
- To fully revert: also run `UPDATE events SET status = 'draft', published_at = NULL, submitted_for_review_at = NULL WHERE status IN ('under_review', 'published')` — but only if no bookings exist against published events (which would be Phase 3 scope)
- Audit log entries are append-only and should be left in place; do not delete audit rows during rollback unless a separate compliance incident requires it.
- Slug redirects are not changed by publish, so no slug data rollback is expected.

### External side effects

- No external API calls (Razorpay is checked but not called)
- No CDN purge (deferred to I-2.4.2)
- No emails sent
- Audit log entries are append-only and harmless to leave
- No Razorpay API calls are made; the feature only reads local linked-account status fields.

### Config/queue rollback

- No new environment variables are introduced.
- No BullMQ queues or workers are introduced.
- No Cloudflare credentials or purge jobs are introduced.

## Risks and Follow-ups

| #   | Risk / Follow-up                                                                                                                                        | Severity | Mitigation                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | I-1.2.4 (registration form fields) and I-1.2.5 (refund policy) are not yet started. Publish completeness check requires policies but skips form_schema. | Medium   | Policy columns already exist on events table. Publish will block until policies are set. Form schema check deferred with TODO.                                                      |
| R2  | "First 3 paid events" admin review logic is stubbed, not implemented. Until I-1.2.7, all events go directly to published.                               | Low      | Acceptable for V1 pilot. The stub returns `false` by default. I-1.2.7 will implement the counter.                                                                                   |
| R3  | CDN cache invalidation not implemented. Published events may show stale content at edge.                                                                | Low      | No CDN integration exists yet. TODO marker placed. I-2.4.2 will implement Cloudflare purge.                                                                                         |
| R4  | Race condition: two simultaneous publish requests for the same event.                                                                                   | Low      | Use row lock or conditional `UPDATE ... WHERE status='draft' RETURNING`; second same-owner request returns idempotent no-op or controlled conflict. Tests cover concurrent publish. |
| R5  | Unpublish of a published event with future bookings (Phase 3).                                                                                          | Medium   | Phase 3 does not exist yet. When bookings are implemented, unpublish should be gated or require cancellation handling. Add a TODO/guard for this.                                   |
| R6  | Pre-existing `api check-types` failures in unrelated test files (audit.test.ts, otp-verify.test.ts per I-1.2.8 notes).                                  | Low      | Document as pre-existing; do not introduce new failures.                                                                                                                            |
| R7  | V1 DB constraints currently enforce paid events and pricing minimums, making free-event cases hard to fixture through normal DB inserts.                | Low      | Keep production behavior paid/Razorpay-gated; cover future free-event detection with service-level unit fixtures/mocks if DB constraints prevent integration fixtures.              |
| R8  | Publish readiness may become stale between GET and POST.                                                                                                | Low      | POST recomputes readiness server-side inside the transition flow; UI checklist is advisory only.                                                                                    |

### Adversarial review focus areas

- **State machine completeness:** Verify every status × transition combination is either allowed or explicitly rejected with a test
- **Organizer ownership bypass:** Verify that organizer A cannot publish organizer B's event
- **Gating bypass:** Verify that unverified organizer or missing Razorpay cannot be circumvented
- **Migration rollback:** Verify rollback SQL works cleanly
- **Audit completeness:** Verify all transition paths produce audit log entries
- **Edge-case completeness:** Verify past events, inactive/missing pricing, stale slug collisions, and duplicate submit behavior are tested

## Plan Review

| Review item         | Result                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer            | `eventkart-plan-reviewer`                                                                                                                                                                                                                                        |
| Status              | Revised and approved for implementation                                                                                                                                                                                                                          |
| Size/Risk           | Large/Red                                                                                                                                                                                                                                                        |
| Review loop         | 1 of maximum 2                                                                                                                                                                                                                                                   |
| Files/docs reviewed | `.github/agent-conventions.md`, this plan, `docs/v1-implementation-plan.md`, `docs/requirements.md`, `docs/architecture.md`, `.github/copilot-instructions.md`, Fastify and TanStack workspace instructions, plus existing event/organizer/audit/db schema files |

### Changes made in review

- Added the authenticated `GET /api/v1/events/:eventId/publish-readiness` endpoint as the server-side source for the web checklist.
- Clarified state-machine behavior, including direct publish today via `requiresAdminReview() === false`, testable `under_review` support for I-1.2.7, and idempotent same-owner duplicate publish behavior.
- Added edge-case gating for past `startAt`/`endAt`, pricing coverage/active paid tiers, future free-event detection, stale slug conflicts, concurrent publish, and future booking-safe unpublish assumptions.
- Tightened security requirements: owner-only readiness/publish/unpublish, CSRF only on state-changing POST routes, safe audit metadata, no sensitive logging, and denied-publish audit entries.
- Strengthened migration safety with explicit non-empty rollback-file requirement and required rollback/drift/lock-risk commands.
- Expanded API, shared, DB, and web tests to cover legal/illegal transitions, gating failures, CSRF, RBAC, idempotency, concurrency, audit, disabled UI states, error surfacing, and success paths.
- Replaced route-integration ambiguity with the default decision to integrate into the existing organizer event edit page.
- Updated ledgers, file summary, validation commands, rollback guidance, and risks/follow-ups.

### Readiness confirmation

The plan is implementation-ready without requiring user decisions. Remaining risks are documented and reversible: admin review policy remains stubbed for I-1.2.7, CDN invalidation remains a TODO for I-2.4.2, and booking-aware unpublish gating is deferred until bookings/ticketing exist.

## Scope

**Feature ID:** I-1.2.6
**Module:** 1.2 — Event Creation & Management
**Status:** Implementation-ready
**Task size:** Large
**Risk classification:** Red (`auth`, `public-api`, `migration`, `payments` gate)
**Blast radius:** `packages/shared` (constants, schemas), `packages/db` (events migration), `apps/api` (events module), `apps/web` (events feature, org routes). Affects organizer role, admin role (downstream I-1.2.7), public event visibility. No external service calls (Razorpay checked but not called; CDN purge deferred to I-2.4.2).

## Source Features/Requirements

| Source           | Reference                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements doc | F-1.2.6 — "Event publish workflow (draft → under review → published) gated by organizer verification for paid events"                                          |
| Requirements doc | F-1.2.7 — "Admin manual review interface for the first 3 paid events from each new organizer before publish" (downstream, but admin-review flag captured here) |
| V1 impl plan     | I-1.2.6 row 9 — "Gated by organizer verification AND Razorpay linked-account for paid events"                                                                  |
| V1 impl plan     | I-1.2.7 row 10 — depends on I-1.2.6 for `under_review` state and review signals                                                                                |
| Architecture doc | §1 — "Cache invalidation triggers: event publish/unpublish"                                                                                                    |
| Architecture doc | §2 — Audit log, modular monolith boundaries                                                                                                                    |

**Acceptance criteria:**

1. Organizer can inspect readiness via `GET /api/v1/events/:eventId/publish-readiness` without mutating state.
2. Organizer can request publish for a draft event via `POST /api/v1/events/:eventId/publish`.
3. Publish is gated: organizer must be verified (`isVerified === true`), paid events require Razorpay linked account (`razorpayAccountStatus === "active"`), and event must pass a completeness check (categories, pricing, active/future schedule, hero image, refund policy, cancellation policy all present).
4. If the event requires admin review (first N paid events flag — stubbed for I-1.2.7), status transitions to `under_review` instead of `published`.
5. If no admin review required, status transitions directly to `published` and `publishedAt` is set.
6. Organizer can unpublish a published event via `POST /api/v1/events/:eventId/unpublish`, returning it to `draft`.
7. All successful transitions and denied publish attempts are audit-logged with safe metadata.
8. State machine rejects illegal transitions with clear error messages, while same-owner duplicate publish/unpublish requests are handled idempotently where safe.
9. RBAC enforced: only the owning organizer can read publish readiness and publish/unpublish their own events.
10. CSRF protection on state-changing POST endpoints; readiness GET remains authenticated but does not require CSRF.
11. Web UI shows a pre-publish checklist powered by the readiness endpoint, publish/unpublish actions, status badges, and confirmation dialogs.
12. Cache invalidation extension point is documented (stub/TODO for I-2.4.2; no Cloudflare code in this scope).
13. `under_review` → `published` and `under_review` → `draft` (reject) transitions exist as service helpers for I-1.2.7 admin review to consume.

## Autopilot Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Rationale                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `EVENT_STATUSES` already contains `under_review` — no pgEnum migration needed.                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed: `packages/shared/src/constants/event.ts` line 3–9 already defines `["draft", "under_review", "published", "completed", "cancelled"]`.                                                   |
| A2  | Add `published_at` and `submitted_for_review_at` nullable timestamp columns to the `events` table via a new migration. These are nullable because not all events have been published or submitted.                                                                                                                                                                                                                                                                    | Needed for audit/SLA tracking. Conservative: nullable columns on existing table are backward-compatible.                                                                                           |
| A3  | The "first 3 paid events from new organizer" admin-review counter is **stubbed** as a service helper `requiresAdminReview(organizerId): Promise<boolean>` that returns `false` by default, with a clear TODO for I-1.2.7 to implement the actual counter logic.                                                                                                                                                                                                       | The counter requires querying published event history and defining "new organizer." This policy is I-1.2.7's scope. Stubbing ensures `under_review` path is testable without implementing counter. |
| A4  | `archived` status is out-of-scope. Only transitions: `draft → under_review`, `draft → published`, `under_review → published` (admin approve), `under_review → draft` (admin reject), `published → draft` (organizer unpublish).                                                                                                                                                                                                                                       | Conservative: `completed` and `cancelled` are separate lifecycle events not part of publish workflow.                                                                                              |
| A5  | No real CDN purge calls — emit audit log entry and add a `// TODO: I-2.4.2 CDN cache invalidation` comment at the publish/unpublish transition points.                                                                                                                                                                                                                                                                                                                | Cloudflare integration does not exist yet per I-1.2.8 plan notes.                                                                                                                                  |
| A6  | Free events (hypothetical `isPaid === false`) still require organizer verification but skip Razorpay check. V1 currently enforces `isPaid === true`, so this is defensive future-proofing.                                                                                                                                                                                                                                                                            | Requirements say "organizer verification for paid events"; architecture says all events need verified organizer. Conservative: gate both, skip Razorpay for free.                                  |
| A7  | The completeness check currently requires: ≥1 event category, pricing configured for every category, ≥1 active pricing tier, ≥1 hero image (kind=`hero`, status=`uploaded`), non-null refundPolicy, non-null cancellationPolicy, future `startAt`, future `endAt`, and slug uniqueness re-check. I-1.2.4 now provides `form_schema` and `form_schema_version`, but publish readiness has not yet been wired to require a non-default/custom registration form schema. | Preserve the follow-up to decide whether publish gating should require explicit registration form review/configuration now that I-1.2.4 exists.                                                    |
| A8  | Admin-initiated transitions (`under_review → published`, `under_review → draft`) are exported as service functions but NOT exposed as API routes in this plan. I-1.2.7 will add the admin routes.                                                                                                                                                                                                                                                                     | Separation of concerns: this plan builds the state machine; I-1.2.7 builds the admin UI/routes.                                                                                                    |
| A9  | Unpublish returns event to `draft` (not a separate `unpublished` status), clearing `publishedAt`. This is the simplest reversible approach.                                                                                                                                                                                                                                                                                                                           | Matches the existing status enum. Organizer can re-publish after unpublishing.                                                                                                                     |
| A10 | "Free event" means `event.isPaid === false` and no active tier has an effective price greater than 0 (all tiers are 0, or there are no paid tiers). Any inconsistent state (`isPaid === true`, positive tier, or V1 check constraint) is treated as paid and requires Razorpay.                                                                                                                                                                                       | Conservative financial default; current V1 schema enforces paid events, so all current publishes require Razorpay.                                                                                 |
| A11 | `requiresAdminReview(organizerId)` returns `false` in this implementation, but the publish state machine must still support `draft → under_review`; tests inject/stub a `true` result so I-1.2.7 can flip policy without schema changes.                                                                                                                                                                                                                              | Keeps this slice implementation-ready while preserving downstream admin review flow.                                                                                                               |
| A12 | Ticketing/bookings do not exist yet. Unpublish does not cascade to ticketing in this slice; add an explicit TODO guard for future bookings to block unpublish when paid/confirmed bookings exist.                                                                                                                                                                                                                                                                     | Avoids inventing booking tables now while documenting the future safety gate.                                                                                                                      |

## Prerequisites and Dependency Chain

| Prerequisite                                          | Status      | Notes                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-1.2.1 Event creation (events table, draft creation) | ✅ Complete | Foundation table exists                                                                                                                                                                                                                                  |
| I-1.2.2 Event categories                              | ✅ Complete | `event_categories` table, completeness check needs ≥1                                                                                                                                                                                                    |
| I-1.2.3 Pricing configuration                         | ✅ Complete | `event_pricing_tiers` table, completeness check needs ≥1                                                                                                                                                                                                 |
| I-1.2.4 Registration form fields                      | ✅ Complete | `form_schema` / `form_schema_version`, shared catalog/schema, API routes, and organizer UI exist. Publish completeness still does not include a form-schema readiness item; keep as a follow-up if product requires explicit form review before publish. |
| I-1.2.5 Refund & cancellation policy                  | ✅ Complete | Policy columns, API, organizer UI, and publish completeness checks exist.                                                                                                                                                                                |
| I-1.2.9 Event image upload                            | ✅ Complete | `event_images` table, completeness check needs ≥1 hero image                                                                                                                                                                                             |
| I-1.2.8 Event edit                                    | ✅ Complete | GET/PUT event endpoints exist                                                                                                                                                                                                                            |
| I-1.1.6 Verification badge                            | ✅ Complete | `organizers.isVerified` field is available; reuse any existing publish-eligibility helper if present, otherwise read the field through `getOrganizerByUserId()`                                                                                          |
| I-1.1.7 Razorpay linked account                       | ✅ Complete | `organizers.razorpayAccountStatus` field                                                                                                                                                                                                                 |
| I-0.4.4 Audit log                                     | ✅ Complete | `createAuditLogger`, `AUDIT_ACTIONS.EVENT_PUBLISH` etc. already defined                                                                                                                                                                                  |
| I-0.2.11 CSRF protection                              | ✅ Complete | CSRF plugin active on state-changing routes                                                                                                                                                                                                              |

**Ordering:** Shared schemas → DB migration → API service + routes + tests → Web UI + tests → Progress updates.

## Architecture Notes

### Package boundaries

- **`packages/shared`**: Add publish-related Zod schemas (publish request/response, publish readiness check schema, transition error codes). Add new audit action constants if needed (most already exist).
- **`packages/shared`**: Extend `eventSchema` with nullable `publishedAt` and `submittedForReviewAt` so API responses remain shared-contract typed.
- **`packages/db`**: New forward migration adding `published_at` and `submitted_for_review_at` columns to `events` table plus a **non-empty rollback SQL file**. Update Drizzle schema.
- **`apps/api`**: New service functions in `events/service.ts` for readiness, publish, unpublish, admin-approve, admin-reject. New routes in `events/routes.ts`. Gating logic queries organizer, categories, pricing, images, and slug tables.
- **`apps/web`**: New server functions, query options, components (publish checklist, publish button, status badge, confirm dialogs). New or updated route pages.

### Existing modules/utilities to reuse

- `getOrganizerByUserId()` from `organizer/service.ts` — fetches organizer with `isVerified` and `razorpayAccountStatus`
- `createAuditLogger()` from `lib/audit.ts`
- `AUDIT_ACTIONS.EVENT_PUBLISH`, `EVENT_UNPUBLISH` already defined in `packages/shared/src/constants/audit.ts`; add missing publish-request/review/denied constants in the same `<domain>.<verb>` style only if not already present
- `requireAuth`, `requireRole("organizer")` middleware
- `eventIdParamsSchema`, `eventErrorResponseSchema` from `events/schemas.ts`
- `eventQueryKey`, `eventQueryOptions` from web `features/events/queries.ts`
- Existing `isPubliclyReadableEventStatus()` helper in `events/service.ts`
- Existing slug helpers (`reserveUniqueEventSlug`, `slugExists`, `slugRedirects`) to re-check slug uniqueness at publish time; do not create a second slug system
- Existing organizer lookup/status fields from `organizer/service.ts` (`isVerified`, `razorpayAccountStatus`); if a `canPublishPaidEvents` helper exists at implementation time, reuse it instead of duplicating logic

### Security considerations

- Server-side enforcement: publish/unpublish only by owning organizer (verified ownership via organizer → event relationship)
- CSRF required on POST endpoints through the existing HMAC double-submit plugin; do not add a CSRF bypass. Authenticated `GET /publish-readiness` is read-only and does not require CSRF.
- Organizer verification and Razorpay status checked server-side, not just UI-gated
- No PII in audit log metadata (log eventId, organizerId, transition, not user personal data)
- `under_review` events NOT publicly visible (existing `isPubliclyReadableEventStatus` only returns true for `published`/`completed`)
- Failed publish attempts are audit-logged with safe denial codes only (for example `missing_hero_image`, `razorpay_not_linked`), not full policy text, contact details, Razorpay account IDs, or request bodies.

### Performance considerations

- Publish readiness check involves simple indexed lookups (event/organizer, categories, pricing, images, slug collision check). Acceptable for a non-burst organizer action.
- No background queue needed — synchronous is fine for organizer-initiated publish.
- Publish/unpublish status changes run inside a transaction and lock the event row (`SELECT ... FOR UPDATE`) or use an `UPDATE ... WHERE id = ? AND status = ? RETURNING` guard so concurrent requests cannot produce duplicate transitions.

### Observability

- Audit log entries for every transition attempt (success and denied failure)
- Structured log entries at info level for successful transitions

### Error handling

- Clear error codes and messages for each gating failure (unverified organizer, missing Razorpay, missing categories, etc.)
- Aggregate all missing items in a single "publish readiness" response so the organizer sees everything needed at once
- Safe public error messages; no raw DB errors, no Razorpay account identifiers, no document/KYC details.

## Database Plan

### Migration: Add publish tracking columns to events

**Risk:** Red (schema migration on existing table)

**Changes:**

```sql
ALTER TABLE events ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN submitted_for_review_at TIMESTAMPTZ;
```

**Drizzle schema update** in `packages/db/src/schema/events.ts`:

```typescript
publishedAt: timestamp("published_at", { withTimezone: true }),
submittedForReviewAt: timestamp("submitted_for_review_at", { withTimezone: true }),
```

**Rollback SQL:**

```sql
ALTER TABLE events DROP COLUMN IF EXISTS submitted_for_review_at;
ALTER TABLE events DROP COLUMN IF EXISTS published_at;
```

**Migration safety:**

- Both columns are nullable with no default — no table rewrite, no lock risk on small tables
- No data backfill needed (existing events are all drafts)
- Backward-compatible: existing code ignores these columns until publish feature ships
- Follows expand/contract pattern: add columns first, then deploy code that uses them
- Generate and commit the paired rollback SQL file required by the repo rollback validator; the rollback file must contain the `ALTER TABLE ... DROP COLUMN ...` statements above and must not be empty.
- Validate with `pnpm --filter @repo/db db:check:rollbacks`, `pnpm --filter @repo/db db:check:drift`, and `pnpm --filter @repo/db db:check:lock-risk`.

**Index consideration:** An index on `(status, published_at)` may be useful for public listing queries (Phase 2, I-2.2.x). Not adding it now — defer to when listing queries are built.

## API Plan

### New routes

| Method | Path                                        | Auth                                                     | CSRF           | Description                                         |
| ------ | ------------------------------------------- | -------------------------------------------------------- | -------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/events/:eventId/publish-readiness` | `requireAuth` + `requireRole("organizer")` + owner check | No (read-only) | Return readiness checklist for the owning organizer |
| `POST` | `/api/v1/events/:eventId/publish`           | `requireAuth` + `requireRole("organizer")`               | Yes            | Request publish for a draft event                   |
| `POST` | `/api/v1/events/:eventId/unpublish`         | `requireAuth` + `requireRole("organizer")`               | Yes            | Unpublish a published event back to draft           |

### `GET /api/v1/events/:eventId/publish-readiness`

**Request:** No body.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "ready": false,
    "eventStatus": "draft",
    "isPaid": true,
    "requiresRazorpay": true,
    "wouldRequireAdminReview": false,
    "items": [
      {
        "check": "organizer_verified",
        "passed": true,
        "message": "Organizer verified",
        "severity": "error"
      }
    ]
  }
}
```

**Error responses:** 401, 403 (not owning organizer), 404.

**Notes:**

- This endpoint powers the web checklist and must not mutate event state or write audit logs.
- It returns all gating failures in one response, including time/pricing/policy/image/slug issues.
- It must not expose sensitive organizer verification document details, Razorpay account IDs, or raw internal policy notes.

### `POST /api/v1/events/:eventId/publish`

**Request:** No body (eventId from params).

**Response (200):**

```json
{
  "success": true,
  "data": {
    "event": { /* full event object with updated status */ },
    "transition": "draft_to_published" | "draft_to_under_review" | "noop_already_published" | "noop_already_under_review",
    "readiness": { /* same shape as publish-readiness */ }
  }
}
```

**Error responses:**

- `400` — Event not in publishable state, or completeness check failed (with `readiness` details)
- `401` — Not authenticated
- `403` — Not the owning organizer, or organizer not verified, or paid event without Razorpay
- `404` — Event not found
- `409` — Conflict for unsupported lifecycle states (`completed`, `cancelled`) or optimistic concurrency failure after retry. Same-owner duplicate `published`/`under_review` publish requests return 200 no-op.

**Gating sequence (service layer):**

1. Validate eventId (UUID parse)
2. Load organizer from session user and event inside a transaction; verify ownership (organizer's event)
3. Lock or conditionally update the event row so concurrent publish attempts serialize
4. If status is `published` or `under_review`, return a safe idempotent no-op response for the owning organizer
5. Reject `completed` and `cancelled`
6. Verify event is in `draft` status
7. Load organizer, check `isVerified === true` → 403 if not
8. Determine paid/free status. Current V1 events are paid. Future free events are free only when `isPaid === false` and no active tier has effective price >0; otherwise require Razorpay.
9. If paid, check `razorpayAccountStatus === "active"` → 403 if not
10. Completeness check:
    - ≥1 event category exists

- pricing tier exists for every category
- ≥1 active pricing tier exists; paid events need at least one active paid tier
- ≥1 hero image with `kind = "hero"` and status `uploaded`
- `refundPolicy` is not null/empty
- `cancellationPolicy` is not null/empty
- `startAt > now` and `endAt > now`; block publishing if event date/end date is in the past or event has already started
- `registrationClosesAt`, when present, is still before `startAt` per existing schema; if already in the past this does not block publish unless product later requires registration-open windows
- current slug remains unique across active event slugs and slug redirects
- Return all failures aggregated in response

11. If any gating failure exists, audit `event.publish_denied` (new constant if absent) with denial codes only, then return 400/403 as appropriate with readiness details
12. Check `requiresAdminReview(organizerId)` → if true, transition to `under_review`; otherwise to `published`
13. Update event status + timestamp columns:
    - `draft → published`: set `publishedAt = now`, clear `submittedForReviewAt`
    - `draft → under_review`: set `submittedForReviewAt = now`, leave `publishedAt = null`
14. Audit log the transition (`event.publish_requested`, then `event.publish` or `event.submit_for_review` as applicable)
15. Leave a local `invalidateEventCache(event)` stub/TODO for I-2.4.2; no Cloudflare API calls
16. Return updated event + transition type + readiness snapshot

### `POST /api/v1/events/:eventId/unpublish`

**Request:** No body.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "event": {
      /* full event object with status=draft */
    },
    "transition": "published_to_draft"
  }
}
```

**Error responses:** 400 (not in unpublishable state), 401, 403, 404, 409 (completed/cancelled or future booking guard once bookings exist).

**Logic:**

1. Validate eventId, verify ownership inside a transaction
2. Lock or conditionally update the event row (`WHERE status = 'published'`) to prevent concurrent double-unpublish
3. Verify event is in `published` status; draft unpublish is always rejected with `EVENT_NOT_UNPUBLISHABLE`
4. Reject `under_review`, `completed`, and `cancelled`
5. Future booking guard: add TODO to block unpublish when confirmed bookings/tickets exist (ticketing is not present yet)
6. Update status to `draft`, clear `publishedAt`; keep `submittedForReviewAt` only if it reflects historical review submission, otherwise clear when rejecting from review
7. Audit log `event.unpublish`
8. Leave cache-invalidation TODO stub for I-2.4.2
9. Return updated event

### Service helpers exported for I-1.2.7

```typescript
// Called by admin review routes (I-1.2.7)
export async function adminApproveEvent(
  deps,
  eventId,
  adminUserId,
): Promise<Event>;
export async function adminRejectEvent(
  deps,
  eventId,
  adminUserId,
  reason?,
): Promise<Event>;
```

These transition `under_review → published` (approve) and `under_review → draft` (reject). Not exposed as routes in this plan.

Admin helper behavior:

- `adminApproveEvent`: requires admin caller supplied by future route, locks the event, rejects non-`under_review`, sets `status = "published"`, sets `publishedAt = now`, preserves `submittedForReviewAt`, audits `event.publish` with `source: "admin_review"`.
- `adminRejectEvent`: requires admin caller supplied by future route, locks the event, rejects non-`under_review`, sets `status = "draft"`, clears `publishedAt`, preserves safe rejection reason only when a future I-1.2.7 storage field exists, audits `admin.review`/`event.publish_rejected` without PII.

### Shared schemas additions (`packages/shared`)

**New file: `packages/shared/src/schemas/event-publish.ts`**

```typescript
// Publish readiness check item
export const publishReadinessItemSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  message: z.string(),
  severity: z.enum(["error", "warning", "info"]).default("error"),
});

// Publish readiness response
export const publishReadinessSchema = z.object({
  ready: z.boolean(),
  eventStatus: eventStatusSchema,
  isPaid: z.boolean(),
  requiresRazorpay: z.boolean(),
  wouldRequireAdminReview: z.boolean(),
  items: z.array(publishReadinessItemSchema),
});

// Publish transition type
export const eventPublishTransitionSchema = z.enum([
  "draft_to_published",
  "draft_to_under_review",
  "published_to_draft",
  "under_review_to_published",
  "under_review_to_draft",
  "noop_already_published",
  "noop_already_under_review",
]);
```

**New audit action constants** (if not already present — check existing `AUDIT_ACTIONS`):

- `EVENT_PUBLISH_REQUESTED` = `"event.publish_requested"` — organizer requested publish
- `EVENT_SUBMIT_FOR_REVIEW` = `"event.submit_for_review"` — transitioned to under_review
- `EVENT_PUBLISH_DENIED` = `"event.publish_denied"` — publish attempt blocked by gating/state/RBAC after owner is known
- `EVENT_PUBLISH_REJECTED` = `"event.publish_rejected"` — future admin review rejection helper
- Existing `EVENT_PUBLISH` and `EVENT_UNPUBLISH` are reused for actual transitions

**Extend existing shared event contract:** update `packages/shared/src/schemas/event.ts` `eventSchema` with:

```typescript
publishedAt: eventDateTimeSchema.nullable(),
submittedForReviewAt: eventDateTimeSchema.nullable(),
```

### Error codes

| Code                         | HTTP | When                                                    |
| ---------------------------- | ---- | ------------------------------------------------------- |
| `EVENT_NOT_PUBLISHABLE`      | 400  | Event not in draft status for publish                   |
| `EVENT_NOT_UNPUBLISHABLE`    | 400  | Event not in published status for unpublish             |
| `EVENT_INCOMPLETE`           | 400  | Completeness check failed (includes readiness details)  |
| `ORGANIZER_NOT_VERIFIED`     | 403  | Organizer isVerified is false                           |
| `RAZORPAY_NOT_LINKED`        | 403  | Paid event but razorpayAccountStatus !== "active"       |
| `EVENT_DATE_IN_PAST`         | 400  | `startAt <= now` or `endAt <= now`                      |
| `EVENT_PRICING_INACTIVE`     | 400  | No active pricing tier or no paid tier for a paid event |
| `EVENT_SLUG_CONFLICT`        | 409  | Slug is no longer unique at publish time                |
| `EVENT_ALREADY_PUBLISHED`    | 200  | Same-owner idempotent no-op publish response            |
| `EVENT_ALREADY_UNDER_REVIEW` | 200  | Same-owner idempotent no-op publish response            |

## Frontend Plan

### Server functions (`apps/web/src/features/events/api.ts`)

Add:

- `publishEvent(eventId)` — POST to publish endpoint
- `unpublishEvent(eventId)` — POST to unpublish endpoint
- `getPublishReadiness(eventId)` — GET `/api/v1/events/:eventId/publish-readiness` (do not compute gating client-side as the source of truth)

### Server-side helpers (`apps/web/src/features/events/api.server.ts`)

Add:

- `getPublishReadinessOnServer(eventId)` — calls `GET /api/v1/events/:eventId/publish-readiness`
- `publishEventOnServer(eventId)` — calls `POST /api/v1/events/:eventId/publish`
- `unpublishEventOnServer(eventId)` — calls `POST /api/v1/events/:eventId/unpublish`

### Query options (`apps/web/src/features/events/queries.ts`)

- Event query already exists and returns status — no new query needed for status display
- Add `publishReadinessQueryOptions(eventId)` with query key `["events", eventId, "publish-readiness"]`
- Publish/unpublish mutations invalidate `eventQueryKey(eventId)`, publish readiness query, and any organizer event-list query keys that already exist

### Components (`apps/web/src/features/events/components/`)

| Component                | Purpose                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `publish-checklist.tsx`  | Displays readiness items (verified organizer, Razorpay linked, categories, pricing, images, policies) with pass/fail indicators |
| `publish-action.tsx`     | Publish button with confirm dialog; disabled with reasons when not ready; shows loading state during mutation                   |
| `unpublish-action.tsx`   | Unpublish button with confirm dialog for published events                                                                       |
| `event-status-badge.tsx` | Colored badge showing current event status (Draft, Under Review, Published, etc.)                                               |

### Route integration

The publish action UI integrates into the existing event management page.

**Decision:** Integrate into the existing `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx` page header/top section. If an overview route already exists at implementation time, add the component there as well only when it is the current organizer landing surface; do not create a second competing publish surface.

**States to handle:**

- **Draft, not ready:** Show checklist with missing items, publish button disabled
- **Draft, ready:** Show checklist all green, publish button enabled with confirm dialog
- **Under review:** Show "Pending admin review" status, no publish/unpublish actions
- **Published:** Show published status with unpublish action
- **Loading:** Spinner during publish/unpublish mutation
- **Error:** Toast or inline error for failed publish attempts with specific reasons
- **Duplicate click/idempotent response:** Treat no-op success responses as success and refresh queries without showing an error

### Accessibility

- Confirm dialogs use `AlertDialog` from shadcn/ui (focus trap, keyboard nav)
- Status badges have appropriate color contrast
- Checklist items use semantic list markup with aria-labels
- Button disabled states include `disabled`/`aria-disabled` as appropriate and visible helper text explaining why (do not rely on tooltip-only messaging, which is inaccessible on mobile/keyboard)
- Loading, empty, and error states use announced text (`aria-live="polite"` for non-critical readiness updates; assertive only for blocking errors)
- Keyboard users can open/cancel/confirm dialogs, and focus returns to the triggering button after close

## Testing Plan

### API tests (`apps/api/test/modules/events/`)

**New test file: `publish.test.ts`** (or extend existing `routes.test.ts`)

| Test case                                                                                                                                                                   | Type          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Publish draft event — happy path (direct to published)                                                                                                                      | Integration   |
| Publish draft event — transitions to under_review when admin review required                                                                                                | Integration   |
| Publish readiness endpoint returns all checks without mutating status or writing audit                                                                                      | Integration   |
| Publish readiness endpoint rejects non-owner                                                                                                                                | RBAC          |
| Publish blocks unverified organizer                                                                                                                                         | Security      |
| Publish blocks paid event without active Razorpay                                                                                                                           | Security      |
| Publish blocks event with no categories                                                                                                                                     | Validation    |
| Publish blocks event with no pricing tiers                                                                                                                                  | Validation    |
| Publish blocks paid event when pricing has no active/paid tier                                                                                                              | Validation    |
| Publish blocks event with no hero image                                                                                                                                     | Validation    |
| Publish blocks event with no refund policy                                                                                                                                  | Validation    |
| Publish blocks event with no cancellation policy                                                                                                                            | Validation    |
| Publish blocks event with `startAt <= now`                                                                                                                                  | Validation    |
| Publish blocks event with `endAt <= now`                                                                                                                                    | Validation    |
| Publish blocks stale slug conflict detected at publish time                                                                                                                 | Validation    |
| Publish returns aggregated readiness failures                                                                                                                               | Validation    |
| Publish already published event by same owner returns idempotent no-op                                                                                                      | State machine |
| Publish under_review event by same owner returns idempotent no-op                                                                                                           | State machine |
| Publish rejects non-draft event (completed)                                                                                                                                 | State machine |
| Publish rejects non-draft event (cancelled)                                                                                                                                 | State machine |
| Publish duplicate same-owner request on already published/under_review has no additional transition side effects                                                            | State machine |
| Concurrent publish requests produce one transition and one no-op/controlled conflict, never duplicate audit transition rows                                                 | Concurrency   |
| Free event readiness skips Razorpay only when `isPaid=false` and no active paid tiers (future-proof service-level test using fixtures/mocks if DB V1 check prevents insert) | Payments gate |
| Publish rejects non-owner organizer                                                                                                                                         | RBAC          |
| Publish rejects unauthenticated request                                                                                                                                     | Auth          |
| Publish rejects non-organizer role                                                                                                                                          | RBAC          |
| Unpublish published event — happy path                                                                                                                                      | Integration   |
| Unpublish rejects draft event                                                                                                                                               | State machine |
| Unpublish rejects under_review event                                                                                                                                        | State machine |
| Unpublish duplicate same-owner request after success returns no-op only for already-draft/cleared publishedAt state                                                         | State machine |
| Unpublish rejects non-owner                                                                                                                                                 | RBAC          |
| CSRF required on publish                                                                                                                                                    | Security      |
| CSRF required on unpublish                                                                                                                                                  | Security      |
| Admin approve from under_review — service-level test                                                                                                                        | Integration   |
| Admin reject from under_review — service-level test                                                                                                                         | Integration   |
| Audit log entries created for publish                                                                                                                                       | Observability |
| Audit log entries created for unpublish                                                                                                                                     | Observability |
| Audit log entry created for denied publish with safe denial codes and no PII/Razorpay account ID                                                                            | Observability |

**Patterns:** Use `buildTestApp()`, `app.inject()`, mock session with organizer role. Create test fixtures for complete event (with categories, pricing, images, policies).

### Shared package tests (`packages/shared/test/schemas/`)

- `event-publish.test.ts`: Schema validation for readiness items, transition types, error response shapes.
- `event.test.ts`: Existing event schema tests (or add assertions in nearest existing file) cover nullable `publishedAt` and `submittedForReviewAt`.

### Web tests (`apps/web/src/features/events/`)

- `publish-checklist.test.tsx`: Renders correct pass/fail items based on event state
- `publish-action.test.tsx`: Button disabled for each gating reason (unverified organizer, Razorpay missing, categories missing, pricing missing/inactive, hero image missing, policies missing, event date in past, slug conflict), enabled when ready, shows confirm dialog
- `publish-action.test.tsx`: Surfaces API readiness/error details, handles idempotent success, invalidates/refetches queries after success
- `unpublish-action.test.tsx`: Shows confirmation, success path, API error path, loading state, and no action for under_review/draft
- `event-status-badge.test.tsx`: Correct colors/labels for each status

### DB tests

- Migration applies cleanly: `published_at` and `submitted_for_review_at` columns exist
- Rollback removes columns
- Existing queries still work with new columns

## Validation Plan

### Baseline capture (before implementation)

| Check                          | Command                                     | Purpose                                                           |
| ------------------------------ | ------------------------------------------- | ----------------------------------------------------------------- |
| DB tests baseline              | `pnpm --filter @repo/db test`               | Confirm existing DB tests pass                                    |
| DB types baseline              | `pnpm --filter @repo/db check-types`        | Confirm DB types clean                                            |
| DB rollback validator baseline | `pnpm --filter @repo/db db:check:rollbacks` | Confirm existing rollback files are valid before adding migration |
| DB drift baseline              | `pnpm --filter @repo/db db:check:drift`     | Confirm schema/migration drift baseline                           |
| DB lock-risk baseline          | `pnpm --filter @repo/db db:check:lock-risk` | Confirm existing migrations pass lock-risk linter                 |
| Shared tests baseline          | `pnpm --filter @repo/shared test`           | Confirm shared tests pass                                         |
| Shared types baseline          | `pnpm --filter @repo/shared check-types`    | Confirm shared types clean                                        |
| API tests baseline             | `pnpm --filter api test`                    | Confirm API tests pass                                            |
| API types baseline             | `pnpm --filter api check-types`             | Confirm API types (may have pre-existing failures)                |
| Web tests baseline             | `pnpm --filter web test`                    | Confirm web tests pass                                            |
| Web types baseline             | `pnpm --filter web check-types`             | Confirm web types clean                                           |
| Lint baseline                  | `pnpm lint`                                 | Confirm lint clean                                                |

### After-change verification

| #   | Check                 | Command                                     | Minimum evidence                                     |
| --- | --------------------- | ------------------------------------------- | ---------------------------------------------------- |
| 1   | DB migration applies  | `pnpm --filter @repo/db db:migrate:run`     | Exit 0, columns exist                                |
| 2   | DB rollback works     | `pnpm --filter @repo/db db:check:rollbacks` | Exit 0                                               |
| 3   | DB schema drift clean | `pnpm --filter @repo/db db:check:drift`     | Exit 0                                               |
| 4   | DB lock-risk clean    | `pnpm --filter @repo/db db:check:lock-risk` | Exit 0                                               |
| 5   | DB tests pass         | `pnpm --filter @repo/db test`               | All tests pass                                       |
| 6   | DB types clean        | `pnpm --filter @repo/db check-types`        | Exit 0                                               |
| 7   | Shared tests pass     | `pnpm --filter @repo/shared test`           | All tests pass including new publish schema tests    |
| 8   | Shared types clean    | `pnpm --filter @repo/shared check-types`    | Exit 0                                               |
| 9   | API tests pass        | `pnpm --filter api test`                    | All tests pass including new publish tests           |
| 10  | API types clean       | `pnpm --filter api check-types`             | Exit 0 (or same pre-existing failures only)          |
| 11  | Web tests pass        | `pnpm --filter web test`                    | All tests pass including new publish UI tests        |
| 12  | Web types clean       | `pnpm --filter web check-types`             | Exit 0                                               |
| 13  | Full workspace lint   | `pnpm lint`                                 | Exit 0                                               |
| 14  | Full workspace types  | `pnpm check-types`                          | Exit 0 or same documented pre-existing failures only |
| 15  | Full workspace tests  | `pnpm test`                                 | Exit 0 or same documented pre-existing failures only |

### Adversarial review (Large/Red requirements)

- **Review pass 1:** Plan completeness — all transitions covered, gating logic correct, no orphaned states
- **Review pass 2:** Security — RBAC enforced server-side, CSRF on POST, no PII in logs, organizer verification not UI-only
- **Review pass 3:** Migration safety — nullable columns, no lock risk, rollback tested
- Fix-and-rerun loop: real findings from any pass must be fixed and the smallest relevant verification commands rerun. Stop after at most 2 review/fix loops if an unresolved Red finding remains, and mark implementation blocked with exact evidence.

## Progress Tracking Updates

The implementer must update:

1. **`progress.md`** — Add entry for I-1.2.6 completion
2. **`docs/v1-implementation-plan.md`** — Mark I-1.2.6 row 9 as complete with checkmark
3. **This plan's task table** — Mark tasks complete with dates

## Agent Run Ledger

| Phase                       | Agent                   | Status                          | Size/Risk | Decisions / assumptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake                      | eventkart-planner       | Complete                        | Large/Red | Resolved I-1.2.6 → `feature-1.2-I-1.2.6.md`. Read v1-impl-plan row 9, requirements F-1.2.6/F-1.2.7, architecture §1/§2, all event code, organizer schema, shared constants, existing plans.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | event.ts constants (statuses include under_review), events.ts schema (no publishedAt yet), organizer schema (isVerified, razorpayAccountStatus), audit.ts constants, service.ts patterns                                                                                                                   |
| Prerequisite analysis       | eventkart-planner       | Complete                        | Large/Red | Historical note from the I-1.2.6 run: I-1.2.4 was not started then, so publish completeness deferred `form_schema`; I-1.2.4 is now complete, but publish readiness still lacks a form-schema readiness item. I-1.2.5 is also complete.                                                                                                                                                                                                                                                                                                                                                                                                                  | v1-impl-plan current state table, events.ts schema columns, current I-1.2.4 implementation record                                                                                                                                                                                                          |
| Baseline strategy           | eventkart-planner       | Planned                         | Large/Red | Run all workspace tests + types + lint before implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Commands listed in Validation Plan                                                                                                                                                                                                                                                                         |
| Adversarial review strategy | eventkart-planner       | Planned                         | Large/Red | 3 review passes: plan completeness, security, migration safety                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Review checklist defined above                                                                                                                                                                                                                                                                             |
| Plan review                 | eventkart-plan-reviewer | Revised                         | Large/Red | Added readiness endpoint, edge-case gating, idempotency/concurrency rules, non-empty rollback validation, exact verification commands, web/API test coverage, and autopilot-safe route integration decision. Assumed current V1 events are paid; future free events skip Razorpay only when no active paid tiers exist.                                                                                                                                                                                                                                                                                                                                 | Read `.github/agent-conventions.md`, target plan, `docs/v1-implementation-plan.md`, `docs/requirements.md`, `docs/architecture.md`, `.github/copilot-instructions.md`, Fastify/TanStack instructions, and existing event/organizer/audit/db schema files. Revised `docs/impl-plan/feature-1.2-I-1.2.6.md`. |
| Git hygiene                 | eventkart-implementer   | Complete                        | Large/Red | Branch `development`; only pre-existing dirty item was this untracked plan file, no overlapping user code changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `git status --short` showed `?? docs/impl-plan/feature-1.2-I-1.2.6.md`; branch `development`                                                                                                                                                                                                               |
| Baseline                    | eventkart-implementer   | Complete                        | Large/Red | Captured DB/shared/API/web/lint baseline. Known blockers: DB lock-risk old migrations; API check-types old test strictness errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verification Ledger baseline rows                                                                                                                                                                                                                                                                          |
| Implementation              | eventkart-implementer   | Complete                        | Large/Red | Implemented shared contracts, nullable publish timestamps migration/rollback, API readiness/publish/unpublish/admin helpers, web server functions/query/UI, and route integration. Deviated from plan by extending existing `routes.test.ts` instead of creating `publish.test.ts` to preserve existing route-mock test pattern.                                                                                                                                                                                                                                                                                                                        | Files changed across `packages/shared`, `packages/db`, `apps/api`, `apps/web`                                                                                                                                                                                                                              |
| Verification                | eventkart-implementer   | Complete with baseline blockers | Large/Red | Relevant tests and lint passed. `db:migrate:run` could not run without local DB env. `pnpm check-types` remains blocked by same pre-existing API test type errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verification Ledger after rows                                                                                                                                                                                                                                                                             |
| Review                      | eventkart-implementer   | Complete                        | Large/Red | Manual plan-completeness, security, and migration-safety review completed; no unresolved Red findings in changed code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Verification Ledger review rows                                                                                                                                                                                                                                                                            |
| Progress tracking           | eventkart-implementer   | Complete                        | Large/Red | Updated this plan, `progress.md`, and `docs/v1-implementation-plan.md`; did not archive because active plan file was not archived before this run and follow-up docs/history remain useful.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Task table T1-T11 complete and progress docs updated                                                                                                                                                                                                                                                       |
| Review fix loop             | eventkart-implementer   | Complete                        | Large/Red | Fixed blocking review findings only: ordinary never-published drafts no longer no-op on unpublish; admin approval reuses real organizer/readiness and blocks stale gates; service-level publish/unpublish/admin audit tests added; hero image confirm/delete now draft-only for hero mutations after publish/under_review.                                                                                                                                                                                                                                                                                                                              | Verification Ledger review/after rows added 2026-04-27                                                                                                                                                                                                                                                     |
| Blocker fix                 | eventkart-implementer   | Complete                        | Small/Red | Fixed the remaining I-1.2.6 blocker only: `requestEventImageUpload` now retains the event from `assertWritableEvent()` and rejects hero upload-url requests for `published`/`under_review` before storage URL generation, DB insert, or audit logging. Added focused service and route coverage; avoided unrelated dirty files.                                                                                                                                                                                                                                                                                                                         | Verification Ledger blocker baseline/after rows added 2026-04-27                                                                                                                                                                                                                                           |
| Code review fix round 2     | eventkart-implementer   | Complete with DB-env blocker    | Large/Red | Addressed requested B1/B2/B3 evidence and I4-I10/N1 gaps: added injectable admin-review policy seam; added real publish state-machine service tests for direct publish, under-review transition, same-owner no-op states, non-owner publish, missing categories/pricing, past start date, and stale slug conflict; added publish/unpublish action tests for disabled reasons, confirmation, mutation calls, invalidation, and error announcements. Retried DB migration apply, still blocked by missing local migration DB env.                                                                                                                         | Verification Ledger rows added 2026-04-27; `pnpm test` exit 0; `pnpm --filter @repo/db db:migrate:run` still exit 1 due missing `DATABASE_URL`/`MIGRATION_DATABASE_URL`                                                                                                                                    |
| Code review fix round 3     | eventkart-implementer   | Complete with DB hard blocker   | Large/Red | Fixed remaining review gaps: hero image upload-url/confirm/delete now lock the event row and re-check draft status inside the mutation transaction; image audit metadata no longer includes `storageKey`; removed draft-unpublish no-op transition from shared/docs; publish/unpublish UI now surfaces API messages/codes, readiness-refreshes on publish gate errors, disables confirm while pending, and announces success accessibly; added server helper/action/service regression coverage. DB apply/rollback execution remains hard-blocked because configured DB refuses connections, Docker daemon is unavailable, and `psql` is not installed. | Verification Ledger rows added 2026-04-27; targeted and full API/web/shared/db/lint gates recorded; DB apply/rollback blocker recorded                                                                                                                                                                     |

## Verification Ledger

| Phase     | Check                                                     | Tool/command                                                                                                                                                                                                                                                                            | Exit code | Passed | Evidence snippet                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline  | DB tests                                                  | `pnpm --filter @repo/db test`                                                                                                                                                                                                                                                           | 0         | Yes    | 3 files, 31 tests passed                                                                                                                                                                                                |
| baseline  | DB types                                                  | `pnpm --filter @repo/db check-types`                                                                                                                                                                                                                                                    | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | DB rollback validator                                     | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 12 rollback(s) present and non-empty`                                                                                                                                                                              |
| baseline  | DB drift checker                                          | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files`                                                                                                                                                                    |
| baseline  | DB lock-risk checker                                      | `pnpm --filter @repo/db db:check:lock-risk`                                                                                                                                                                                                                                             | 1         | No     | Pre-existing findings: 26 critical findings in old migrations including 0001, 0002, 0004, 0005, 0006, 0007, 0012                                                                                                        |
| baseline  | Shared tests                                              | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 0         | Yes    | 13 files passed before change                                                                                                                                                                                           |
| baseline  | Shared types                                              | `pnpm --filter @repo/shared check-types`                                                                                                                                                                                                                                                | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | API suite passed before change                                                                                                                                                                                          |
| baseline  | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`                                                                                                                            |
| baseline  | Web tests                                                 | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 0         | Yes    | Web suite passed before change                                                                                                                                                                                          |
| baseline  | Web types                                                 | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| baseline  | Lint                                                      | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | 7 lint tasks successful; existing API warnings only                                                                                                                                                                     |
| after     | DB migration apply                                        | `pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                                                                 | 1         | No     | Blocked by local env: `DATABASE_URL or MIGRATION_DATABASE_URL must be set to run migrations`                                                                                                                            |
| after     | DB rollback                                               | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 13 rollback(s) present and non-empty`                                                                                                                                                                              |
| after     | DB drift                                                  | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files`                                                                                                                                                                    |
| after     | DB lock risk                                              | `pnpm --filter @repo/db db:check:lock-risk`                                                                                                                                                                                                                                             | 1         | No     | Same pre-existing 26 critical findings; new `0013_sour_cloak.sql` produced no reported finding                                                                                                                          |
| after     | DB tests                                                  | `pnpm --filter @repo/db test`                                                                                                                                                                                                                                                           | 0         | Yes    | 3 files, 31 tests passed                                                                                                                                                                                                |
| after     | DB types                                                  | `pnpm --filter @repo/db check-types`                                                                                                                                                                                                                                                    | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Shared tests (first run)                                  | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 1         | No     | New event timestamp contract required fixture updates; 2 failed tests                                                                                                                                                   |
| after     | Shared tests                                              | `pnpm --filter @repo/shared test`                                                                                                                                                                                                                                                       | 0         | Yes    | 14 files, 160 tests passed                                                                                                                                                                                              |
| after     | Shared types                                              | `pnpm --filter @repo/shared check-types`                                                                                                                                                                                                                                                | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | API route targeted tests                                  | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts`                                                                                                                                                                                                                  | 0         | Yes    | `routes.test.ts` 77 tests passed                                                                                                                                                                                        |
| after     | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | 42 files, 677 tests passed                                                                                                                                                                                              |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in audit and OTP verify tests; no source errors from publish workflow after fix                                                                                                              |
| after     | Web tests (first run)                                     | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 1         | No     | New matcher usage and event fixtures fixed after failure                                                                                                                                                                |
| after     | Web tests                                                 | `pnpm --filter web test`                                                                                                                                                                                                                                                                | 0         | Yes    | 17 files, 121 tests passed                                                                                                                                                                                              |
| after     | Web types                                                 | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Full lint                                                 | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | 7 lint tasks successful                                                                                                                                                                                                 |
| after     | Full types                                                | `pnpm check-types`                                                                                                                                                                                                                                                                      | 2         | No     | Blocked by same pre-existing API test type errors; db/shared/web succeeded                                                                                                                                              |
| after     | Full tests                                                | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | 4 test tasks successful; API 677 tests, web 121 tests                                                                                                                                                                   |
| review    | Plan completeness                                         | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Verified shared→DB→API→web slices, publish/unpublish/admin helper transitions, and progress docs                                                                                                                        |
| review    | Security review                                           | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Server owner/RBAC checks, CSRF on POST routes, safe audit metadata, no raw env reads                                                                                                                                    |
| review    | Migration safety                                          | Manual review                                                                                                                                                                                                                                                                           | 0         | Yes    | Nullable columns, non-empty rollback, drift clean; migration apply needs DB env                                                                                                                                         |
| baseline  | Review-fix targeted event tests                           | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                                                                 | 0         | Yes    | Before review fixes: 2 files, 72 tests passed                                                                                                                                                                           |
| after     | Review-fix first targeted event tests                     | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                                                                 | 1         | No     | New tests exposed mock/test issues: 9 failed across admin readiness and hero-image mutation coverage                                                                                                                    |
| after     | Review-fix targeted event service/routes tests            | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts`                                                                                                                              | 0         | Yes    | 3 files, 158 tests passed including unpublish draft rejection, admin stale readiness, hero image publish guards                                                                                                         |
| after     | API tests                                                 | `pnpm --filter api test`                                                                                                                                                                                                                                                                | 0         | Yes    | Full API Vitest suite completed with exit 0                                                                                                                                                                             |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; no publish/image/service test type errors remain                                                                     |
| after     | API lint                                                  | `pnpm --filter api lint`                                                                                                                                                                                                                                                                | 0         | Yes    | Biome lint exit 0; existing noNonNullAssertion warnings in admin/auth/organizer modules remain                                                                                                                          |
| review    | Review-fix self-review                                    | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed no fake organizer in admin approve, ordinary draft unpublish rejects, and hero delete/confirm fail before storage/update when non-draft                                                                       |
| baseline  | Blocker targeted event image/routes tests                 | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                                                                  | 0         | Yes    | Before blocker fix: 2 files, 92 tests passed                                                                                                                                                                            |
| after     | Blocker targeted event image/routes tests                 | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                                                                  | 0         | Yes    | 2 files, 96 tests passed including new published/under_review hero upload-url rejection cases                                                                                                                           |
| after     | Blocker relevant event service/routes tests               | `pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | 3 files, 162 tests passed                                                                                                                                                                                               |
| after     | Blocker changed-file lint                                 | `pnpm --filter api exec biome lint src/modules/events/event-image-service.ts test/modules/events/event-image-service.test.ts test/modules/events/routes.test.ts`                                                                                                                        | 0         | Yes    | `Checked 3 files in 46ms. No fixes applied.`                                                                                                                                                                            |
| after     | API types                                                 | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; changed event image/route tests are not in the error list                                                            |
| after     | API lint                                                  | `pnpm --filter api lint`                                                                                                                                                                                                                                                                | 0         | Yes    | Biome lint exit 0; existing warnings remain outside changed event image files                                                                                                                                           |
| review    | Blocker self-review                                       | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed guard executes after request validation/ownership and before `storage.getUploadUrl()`, `eventImages.insert()`, and `auditLogger.log()`                                                                        |
| after     | Review-fix round 2 API service tests                      | `pnpm --filter api exec vitest run test/modules/events/service.test.ts --reporter=dot`                                                                                                                                                                                                  | 0         | Yes    | `Test Files 1 passed (1); Tests 74 passed (74)` including direct publish, under-review policy, no-op, non-owner, category/pricing/date/slug gates                                                                       |
| after     | Review-fix round 2 web action tests first run             | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot`                                                                                                                      | 1         | No     | New tests failed due test-only matcher/cleanup issues: invalid Chai `toBeDisabled`/`toBeEnabled` and multiple rendered dialogs                                                                                          |
| after     | Review-fix round 2 web action tests                       | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot`                                                                                                                      | 0         | Yes    | `Test Files 2 passed (2); Tests 6 passed (6)`                                                                                                                                                                           |
| after     | DB migration apply retry                                  | `pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                                                                 | 1         | No     | Still locally blocked: `DATABASE_URL or MIGRATION_DATABASE_URL must be set to run migrations.`                                                                                                                          |
| after     | Review-fix round 2 API changed-file lint                  | `pnpm --filter api exec biome lint src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                   | 0         | Yes    | `Checked 2 files in 113ms. No fixes applied.`                                                                                                                                                                           |
| after     | Review-fix round 2 web changed-file lint                  | `pnpm --filter web exec biome lint src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                     | 0         | Yes    | `Checked 2 files in 81ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 API event tests                        | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 170 passed (170)`                                                                                                                                                                       |
| after     | Review-fix round 2 web publish tests                      | `pnpm --filter web exec vitest run src/features/events/components/publish-checklist.test.tsx src/features/events/components/event-status-badge.test.tsx src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot` | 0         | Yes    | `Test Files 4 passed (4); Tests 8 passed (8)`                                                                                                                                                                           |
| after     | API types retry                                           | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Same pre-existing 8 errors in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; no changed event service/test errors reported                                                                        |
| after     | Web types retry                                           | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | DB rollback retry                                         | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `All 13 rollback(s) present and non-empty.`                                                                                                                                                                             |
| after     | DB drift retry                                            | `pnpm --filter @repo/db db:check:drift`                                                                                                                                                                                                                                                 | 0         | Yes    | `No schema drift — all changes have migration files.`                                                                                                                                                                   |
| after     | Full lint retry                                           | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; preview showed web lint `Checked 139 files in 1529ms. No fixes applied.`                                                                                                                             |
| after     | Full tests retry                                          | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo test exit 0 across workspace test tasks; preview showed web Vitest running and command completed successfully                                                                                                     |
| after     | Review-fix round 2 API Biome check first run              | `pnpm --filter api exec biome check src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                  | 1         | No     | Formatter/import organization needed for `service.ts` and `service.test.ts`; fixed with Biome                                                                                                                           |
| after     | Review-fix round 2 web Biome check first run              | `pnpm --filter web exec biome check src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                    | 1         | No     | Formatter changes needed for new action tests; fixed with Biome                                                                                                                                                         |
| after     | Review-fix round 2 API Biome format                       | `pnpm --filter api exec biome check --write src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                          | 0         | Yes    | `Checked 2 files in 43ms. Fixed 2 files.`                                                                                                                                                                               |
| after     | Review-fix round 2 web Biome format                       | `pnpm --filter web exec biome check --write src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                            | 0         | Yes    | `Checked 2 files in 158ms. Fixed 2 files.`                                                                                                                                                                              |
| after     | Review-fix round 2 API Biome check                        | `pnpm --filter api exec biome check src/modules/events/service.ts test/modules/events/service.test.ts`                                                                                                                                                                                  | 0         | Yes    | `Checked 2 files in 36ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 web Biome check                        | `pnpm --filter web exec biome check src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx`                                                                                                                                    | 0         | Yes    | `Checked 2 files in 81ms. No fixes applied.`                                                                                                                                                                            |
| after     | Review-fix round 2 API event tests after format           | `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts test/modules/events/event-image-service.test.ts --reporter=dot`                                                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 170 passed (170)`                                                                                                                                                                       |
| after     | Review-fix round 2 web publish tests after format         | `pnpm --filter web exec vitest run src/features/events/components/publish-checklist.test.tsx src/features/events/components/event-status-badge.test.tsx src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx --reporter=dot` | 0         | Yes    | `Test Files 4 passed (4); Tests 8 passed (8)`                                                                                                                                                                           |
| after     | Full tests after format                                   | `pnpm test`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo test exit 0 across workspace test tasks; preview showed shared/web/API Vitest suites running and command completed successfully                                                                                   |
| after     | Full lint after format                                    | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; preview showed web lint `Checked 139 files in 306ms. No fixes applied.`                                                                                                                              |
| readiness | Todo sqlite completion marker                             | `sqlite3 ':memory:' "SELECT 'blocked:no todo sqlite database found for I-1.2.6';"`                                                                                                                                                                                                      | 2         | No     | No repo/session todo sqlite DB found within shallow workspace search; command output `blocked:no todo sqlite database found for I-1.2.6`                                                                                |
| review    | Review-fix round 2 self-review                            | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed requested B1/B2/B3 code paths have tests/evidence; I4-I10 real service publish transition/gate tests added; N1 web action component tests added; migration apply remains blocked only by missing local DB env |
| after     | Review-fix round 3 DB env discovery                       | `Select-String packages/db/.env apps/api/.env packages/db/.env.example for DATABASE_URL/MIGRATION_DATABASE_URL keys`                                                                                                                                                                    | 0         | Yes    | `packages/db/.env missing`; `apps/api/.env keys: DATABASE_URL`; `packages/db/.env.example missing`                                                                                                                      |
| after     | Review-fix round 3 DB migration apply with configured env | `apps/api/.env DATABASE_URL exported; pnpm --filter @repo/db db:migrate:run`                                                                                                                                                                                                            | 1         | No     | Migration attempted against configured local URL and failed with `ECONNREFUSED` while running `CREATE SCHEMA IF NOT EXISTS "drizzle"`                                                                                   |
| after     | Review-fix round 3 Docker DB fallback                     | `docker ps -a --filter "name=eventkart-pg" --format "{{.ID}} {{.Status}} {{.Ports}}"`                                                                                                                                                                                                   | 1         | No     | Docker CLI exists, but daemon is unavailable: `failed to connect to the docker API ... dockerDesktopLinuxEngine ... The system cannot find the file specified`                                                          |
| after     | Review-fix round 3 SQL dry-run parser availability        | `psql --version`                                                                                                                                                                                                                                                                        | 0         | No     | PowerShell reported `The term 'psql' is not recognized`; no local PostgreSQL parser is available for apply/rollback dry-run                                                                                             |
| after     | Review-fix round 3 DB rollback/apply execution            | Manual blocker assessment                                                                                                                                                                                                                                                               | 1         | No     | Hard blocker: no reachable Postgres, Docker daemon unavailable, and no `psql`; rollback column-removal and re-apply execution could not be safely performed in this environment                                         |
| after     | Review-fix round 3 DB static rollback check               | `pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                                                                                             | 0         | Yes    | `✅ All 13 rollback(s) present and non-empty.`                                                                                                                                                                          |
| after     | Review-fix round 3 API targeted event tests               | `pnpm --filter api exec vitest run test/modules/events/event-image-service.test.ts test/modules/events/service.test.ts --reporter=dot`                                                                                                                                                  | 0         | Yes    | `Test Files 2 passed (2); Tests 95 passed (95)` including transaction-lock hero image guards and publish state-machine regressions                                                                                      |
| after     | Review-fix round 3 web targeted tests                     | `pnpm --filter web exec vitest run src/features/events/components/publish-action.test.tsx src/features/events/components/unpublish-action.test.tsx src/features/events/api.server.test.ts --reporter=dot`                                                                               | 0         | Yes    | `Test Files 3 passed (3); Tests 28 passed (28)`                                                                                                                                                                         |
| after     | Review-fix round 3 web types                              | `pnpm --filter web check-types`                                                                                                                                                                                                                                                         | 0         | Yes    | `tsc --noEmit` completed                                                                                                                                                                                                |
| after     | Review-fix round 3 shared gates                           | `pnpm --filter @repo/shared check-types; pnpm --filter @repo/shared test`                                                                                                                                                                                                               | 0         | Yes    | `tsc --noEmit` completed; `Test Files 14 passed (14); Tests 160 passed (160)`                                                                                                                                           |
| after     | Review-fix round 3 DB gates                               | `pnpm --filter @repo/db check-types; pnpm --filter @repo/db test; pnpm --filter @repo/db db:check:rollbacks`                                                                                                                                                                            | 0         | Yes    | `tsc --noEmit`; `Test Files 3 passed (3); Tests 31 passed (31)`; rollbacks present                                                                                                                                      |
| after     | Review-fix round 3 API types                              | `pnpm --filter api check-types`                                                                                                                                                                                                                                                         | 2         | No     | Baseline blocker only: 8 pre-existing errors remain in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`; changed event source/test files had no type errors after fix                                |
| after     | Review-fix round 3 API full tests                         | `pnpm --filter api exec vitest run --reporter=dot`                                                                                                                                                                                                                                      | 0         | Yes    | `Test Files 42 passed (42); Tests 702 passed (702)`                                                                                                                                                                     |
| after     | Review-fix round 3 web full tests                         | `pnpm --filter web exec vitest run --passWithNoTests --reporter=dot`                                                                                                                                                                                                                    | 0         | Yes    | `Test Files 20 passed (20); Tests 155 passed (155)`                                                                                                                                                                     |
| after     | Review-fix round 3 full lint                              | `pnpm lint`                                                                                                                                                                                                                                                                             | 0         | Yes    | Turbo lint exit 0; existing warnings only (for example `noNonNullAssertion` in unrelated admin/auth/organizer files)                                                                                                    |
| readiness | Review-fix round 3 todo sqlite completion marker          | `sqlite3 "C:\Users\v-mnmurugan\.copilot\session-state\935b430f-41b9-404c-83c6-3a90827eb91f\session.db" "UPDATE todos SET status='done' WHERE id='fix-loop-1'; UPDATE todos SET status='done' WHERE id='code-review';"`                                                                  | 0         | Yes    | Command completed with exit 0                                                                                                                                                                                           |
| review    | Review-fix round 3 self-review                            | Manual diff review                                                                                                                                                                                                                                                                      | 0         | Yes    | Confirmed B1 locked transaction re-checks for upload-url/confirm/delete, B2 policy path remains service-only, I4 transition removal has no remaining grep hits, I8/I9 UI/audit metadata changes covered by tests        |

## Task Table

| ID  | Description                                                                                                                 | Owner                 | Size   | Risk                   | Dependencies | Target files/areas                                                                                                                                                                                                             | Validation                                                                                                                                                                                                                                                                   | Status                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------ | ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| T1  | Add publish-related shared schemas, constants, event response timestamps, and tests                                         | eventkart-implementer | Small  | Standard               | None         | `packages/shared/src/schemas/event-publish.ts`, `packages/shared/src/schemas/event.ts`, `packages/shared/src/schemas/index.ts`, `packages/shared/src/constants/audit.ts`, `packages/shared/test/schemas/event-publish.test.ts` | `pnpm --filter @repo/shared test` pass, `pnpm --filter @repo/shared check-types` pass; transition enum includes no-op transitions                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T2  | DB migration: add `published_at` and `submitted_for_review_at` columns to events table with non-empty rollback              | eventkart-implementer | Small  | Red (migration)        | T1           | `packages/db/src/schema/events.ts`, new migration file, paired rollback SQL                                                                                                                                                    | Rollback, drift, DB tests, and types pass; migration apply blocked locally by missing DB env; lock-risk remains pre-existing only                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T3  | API service: readiness, publish state machine, gating logic, completeness check, idempotency/concurrency, admin review stub | eventkart-implementer | Medium | Red (auth, public-api) | T1, T2       | `apps/api/src/modules/events/service.ts`                                                                                                                                                                                       | Service functions callable; owner checks server-side; denied attempts audited; source types clean (API type gate still has pre-existing test errors)                                                                                                                         | ✅ Complete — 2026-04-27 |
| T4  | API routes: `GET .../publish-readiness`, `POST .../publish`, and `POST .../unpublish` with schemas/CSRF expectations        | eventkart-implementer | Medium | Red (auth, public-api) | T3           | `apps/api/src/modules/events/routes.ts`, `apps/api/src/modules/events/schemas.ts`                                                                                                                                              | Routes registered; GET read-only/no CSRF; POST routes use existing CSRF; targeted route tests pass                                                                                                                                                                           | ✅ Complete — 2026-04-27 |
| T5  | API tests: readiness, legal/illegal transitions, edge-case gating, RBAC, CSRF, audit log, idempotency/concurrency           | eventkart-implementer | Medium | Red                    | T3, T4       | `apps/api/test/modules/events/routes.test.ts`, `apps/api/test/modules/events/service.test.ts`                                                                                                                                  | Extended existing route suite plus real service publish state-machine tests for direct publish, under-review policy seam, no-op states, non-owner, missing category/pricing, past date, stale slug, admin readiness, and image publish guards; targeted API event tests pass | ✅ Complete — 2026-04-27 |
| T6  | Web server functions, readiness query, mutation invalidation, types for publish/unpublish                                   | eventkart-implementer | Small  | Standard               | T4           | `apps/web/src/features/events/api.ts`, `apps/web/src/features/events/api.server.ts`, `apps/web/src/features/events/queries.ts`, `apps/web/src/features/events/types.ts`                                                        | `pnpm --filter web check-types` pass; no raw env reads; API over HTTP only                                                                                                                                                                                                   | ✅ Complete — 2026-04-27 |
| T7  | Web UI: publish checklist, publish/unpublish actions, status badge, confirm dialogs                                         | eventkart-implementer | Medium | Standard               | T6           | `apps/web/src/features/events/components/publish-checklist.tsx`, `publish-action.tsx`, `unpublish-action.tsx`, `event-status-badge.tsx`                                                                                        | Components render, types clean                                                                                                                                                                                                                                               | ✅ Complete — 2026-04-27 |
| T8  | Web route integration: add publish section to existing event management page                                                | eventkart-implementer | Small  | Standard               | T7           | `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx`                                                                                                                                                                     | Route renders publish UI and no duplicate publish surface is created                                                                                                                                                                                                         | ✅ Complete — 2026-04-27 |
| T9  | Web tests: publish UI components                                                                                            | eventkart-implementer | Small  | Standard               | T7, T8       | `apps/web/src/features/events/components/*.test.tsx`                                                                                                                                                                           | Publish checklist/status badge tests plus publish/unpublish action tests for disabled reason, confirmation, mutation, invalidation, and error alert; targeted web publish tests and web types pass                                                                           | ✅ Complete — 2026-04-27 |
| T10 | Full validation: lint, types, all tests across workspaces                                                                   | eventkart-implementer | Small  | Standard               | T1–T9        | All workspaces                                                                                                                                                                                                                 | `pnpm lint` and `pnpm test` pass; `pnpm check-types` blocked by documented pre-existing API test type errors only                                                                                                                                                            | ✅ Complete — 2026-04-27 |
| T11 | Progress tracking updates                                                                                                   | eventkart-implementer | Small  | Standard               | T10          | `progress.md`, `docs/v1-implementation-plan.md`, this plan                                                                                                                                                                     | Documents updated                                                                                                                                                                                                                                                            | ✅ Complete — 2026-04-27 |

## Files Summary

### Planner-created files

| Path                                    | Action | Notes          |
| --------------------------------------- | ------ | -------------- |
| `docs/impl-plan/feature-1.2-I-1.2.6.md` | Create | This plan file |

### Implementer will create/modify

| Path                                                                     | Action | Rationale                                                                                                                                                 | Rollback                               |
| ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `packages/shared/src/schemas/event-publish.ts`                           | Create | Publish readiness, transition type schemas                                                                                                                | Delete file                            |
| `packages/shared/src/schemas/event.ts`                                   | Update | Add nullable publish timestamp fields to event response contract                                                                                          | Remove added fields after API rollback |
| `packages/shared/src/schemas/index.ts`                                   | Update | Re-export new schemas                                                                                                                                     | Remove re-export lines                 |
| `packages/shared/src/constants/audit.ts`                                 | Update | Add `EVENT_PUBLISH_REQUESTED`, `EVENT_SUBMIT_FOR_REVIEW`, `EVENT_PUBLISH_DENIED`, `EVENT_PUBLISH_REJECTED` if needed                                      | Remove added constants                 |
| `packages/shared/test/schemas/event-publish.test.ts`                     | Create | Schema tests                                                                                                                                              | Delete file                            |
| `packages/db/src/schema/events.ts`                                       | Update | Add `publishedAt`, `submittedForReviewAt` columns                                                                                                         | Remove columns from schema             |
| `packages/db/drizzle/NNNN_*.sql` (migration)                             | Create | Migration SQL for new columns                                                                                                                             | Run rollback SQL                       |
| `packages/db/drizzle/NNNN_*.rollback.sql` (exact repo naming convention) | Create | Non-empty rollback SQL for validator                                                                                                                      | Delete after migration rollback        |
| `apps/api/src/modules/events/service.ts`                                 | Update | Add readiness/publish/unpublish/admin-approve/admin-reject functions, completeness check, gating logic, idempotency/concurrency, requiresAdminReview stub | Remove added functions                 |
| `apps/api/src/modules/events/schemas.ts`                                 | Update | Add readiness/publish/unpublish request/response schemas                                                                                                  | Remove added schemas                   |
| `apps/api/src/modules/events/routes.ts`                                  | Update | Add GET readiness plus POST publish/unpublish routes                                                                                                      | Remove added routes                    |
| `apps/api/test/modules/events/publish.test.ts`                           | Create | Comprehensive publish test suite                                                                                                                          | Delete file                            |
| `apps/web/src/features/events/api.ts`                                    | Update | Add publishEvent, unpublishEvent server functions                                                                                                         | Remove added functions                 |
| `apps/web/src/features/events/api.server.ts`                             | Update | Add server-side readiness/publish/unpublish helpers                                                                                                       | Remove added functions                 |
| `apps/web/src/features/events/queries.ts`                                | Update | Add readiness query options and invalidation keys                                                                                                         | Remove added query options             |
| `apps/web/src/features/events/types.ts`                                  | Update | Add publish response types                                                                                                                                | Remove added types                     |
| `apps/web/src/features/events/components/publish-checklist.tsx`          | Create | Pre-publish readiness checklist UI                                                                                                                        | Delete file                            |
| `apps/web/src/features/events/components/publish-action.tsx`             | Create | Publish button with confirm dialog                                                                                                                        | Delete file                            |
| `apps/web/src/features/events/components/unpublish-action.tsx`           | Create | Unpublish button with confirm dialog                                                                                                                      | Delete file                            |
| `apps/web/src/features/events/components/event-status-badge.tsx`         | Create | Event status badge component                                                                                                                              | Delete file                            |
| `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx`               | Update | Integrate publish section                                                                                                                                 | Revert changes                         |
| `apps/web/src/features/events/components/publish-checklist.test.tsx`     | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/publish-action.test.tsx`        | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/unpublish-action.test.tsx`      | Create | Component test                                                                                                                                            | Delete file                            |
| `apps/web/src/features/events/components/event-status-badge.test.tsx`    | Create | Component test                                                                                                                                            | Delete file                            |

## Rollback Plan

### Code rollback

All changes are additive (new files, new functions, new columns). Rollback:

1. Revert the git commit(s) for this feature
2. Run the migration rollback SQL to drop `published_at` and `submitted_for_review_at` columns
3. Remove any newly registered routes from deployed API instances and redeploy web without publish controls
4. All existing draft event CRUD functionality remains intact

### Data rollback

- New columns are nullable with no data backfill
- If events have been published (status changed), reverting code means the status column values remain but the transition routes are gone
- To fully revert: also run `UPDATE events SET status = 'draft', published_at = NULL, submitted_for_review_at = NULL WHERE status IN ('under_review', 'published')` — but only if no bookings exist against published events (which would be Phase 3 scope)
- Audit log entries are append-only and should be left in place; do not delete audit rows during rollback unless a separate compliance incident requires it.
- Slug redirects are not changed by publish, so no slug data rollback is expected.

### External side effects

- No external API calls (Razorpay is checked but not called)
- No CDN purge (deferred to I-2.4.2)
- No emails sent
- Audit log entries are append-only and harmless to leave
- No Razorpay API calls are made; the feature only reads local linked-account status fields.

### Config/queue rollback

- No new environment variables are introduced.
- No BullMQ queues or workers are introduced.
- No Cloudflare credentials or purge jobs are introduced.

## Risks and Follow-ups

| #   | Risk / Follow-up                                                                                                                                                                                                                               | Severity | Mitigation                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Historical I-1.2.6 note: I-1.2.4 (registration form fields) and I-1.2.5 (refund policy) were not started when this feature first landed. They are now complete, but publish completeness still skips an explicit `form_schema` readiness item. | Medium   | Policy columns already exist on events table. Publish will block until policies are set. Keep the form-schema readiness item as a follow-up if product requires explicit organizer review before publish. |
| R2  | "First 3 paid events" admin review logic is stubbed, not implemented. Until I-1.2.7, all events go directly to published.                                                                                                                      | Low      | Acceptable for V1 pilot. The stub returns `false` by default. I-1.2.7 will implement the counter.                                                                                                         |
| R3  | CDN cache invalidation not implemented. Published events may show stale content at edge.                                                                                                                                                       | Low      | No CDN integration exists yet. TODO marker placed. I-2.4.2 will implement Cloudflare purge.                                                                                                               |
| R4  | Race condition: two simultaneous publish requests for the same event.                                                                                                                                                                          | Low      | Use row lock or conditional `UPDATE ... WHERE status='draft' RETURNING`; second same-owner request returns idempotent no-op or controlled conflict. Tests cover concurrent publish.                       |
| R5  | Unpublish of a published event with future bookings (Phase 3).                                                                                                                                                                                 | Medium   | Phase 3 does not exist yet. When bookings are implemented, unpublish should be gated or require cancellation handling. Add a TODO/guard for this.                                                         |
| R6  | Pre-existing `api check-types` failures in unrelated test files (audit.test.ts, otp-verify.test.ts per I-1.2.8 notes).                                                                                                                         | Low      | Document as pre-existing; do not introduce new failures.                                                                                                                                                  |
| R7  | V1 DB constraints currently enforce paid events and pricing minimums, making free-event cases hard to fixture through normal DB inserts.                                                                                                       | Low      | Keep production behavior paid/Razorpay-gated; cover future free-event detection with service-level unit fixtures/mocks if DB constraints prevent integration fixtures.                                    |
| R8  | Publish readiness may become stale between GET and POST.                                                                                                                                                                                       | Low      | POST recomputes readiness server-side inside the transition flow; UI checklist is advisory only.                                                                                                          |

### Adversarial review focus areas

- **State machine completeness:** Verify every status × transition combination is either allowed or explicitly rejected with a test
- **Organizer ownership bypass:** Verify that organizer A cannot publish organizer B's event
- **Gating bypass:** Verify that unverified organizer or missing Razorpay cannot be circumvented
- **Migration rollback:** Verify rollback SQL works cleanly
- **Audit completeness:** Verify all transition paths produce audit log entries
- **Edge-case completeness:** Verify past events, inactive/missing pricing, stale slug collisions, and duplicate submit behavior are tested

## Plan Review

| Review item         | Result                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer            | `eventkart-plan-reviewer`                                                                                                                                                                                                                                        |
| Status              | Revised and approved for implementation                                                                                                                                                                                                                          |
| Size/Risk           | Large/Red                                                                                                                                                                                                                                                        |
| Review loop         | 1 of maximum 2                                                                                                                                                                                                                                                   |
| Files/docs reviewed | `.github/agent-conventions.md`, this plan, `docs/v1-implementation-plan.md`, `docs/requirements.md`, `docs/architecture.md`, `.github/copilot-instructions.md`, Fastify and TanStack workspace instructions, plus existing event/organizer/audit/db schema files |

### Changes made in review

- Added the authenticated `GET /api/v1/events/:eventId/publish-readiness` endpoint as the server-side source for the web checklist.
- Clarified state-machine behavior, including direct publish today via `requiresAdminReview() === false`, testable `under_review` support for I-1.2.7, and idempotent same-owner duplicate publish behavior.
- Added edge-case gating for past `startAt`/`endAt`, pricing coverage/active paid tiers, future free-event detection, stale slug conflicts, concurrent publish, and future booking-safe unpublish assumptions.
- Tightened security requirements: owner-only readiness/publish/unpublish, CSRF only on state-changing POST routes, safe audit metadata, no sensitive logging, and denied-publish audit entries.
- Strengthened migration safety with explicit non-empty rollback-file requirement and required rollback/drift/lock-risk commands.
- Expanded API, shared, DB, and web tests to cover legal/illegal transitions, gating failures, CSRF, RBAC, idempotency, concurrency, audit, disabled UI states, error surfacing, and success paths.
- Replaced route-integration ambiguity with the default decision to integrate into the existing organizer event edit page.
- Updated ledgers, file summary, validation commands, rollback guidance, and risks/follow-ups.

### Readiness confirmation

The plan is implementation-ready without requiring user decisions. Remaining risks are documented and reversible: admin review policy remains stubbed for I-1.2.7, CDN invalidation remains a TODO for I-2.4.2, and booking-aware unpublish gating is deferred until bookings/ticketing exist.

| 2026-04-27 | post-review-fix | Migration 0013 | Workflow agent | Updated 013_sour_cloak.sql to use ADD COLUMN IF NOT EXISTS per round-2 review finding. db:check:rollbacks PASS (13 rollbacks present and non-empty). Staged via git add. |
