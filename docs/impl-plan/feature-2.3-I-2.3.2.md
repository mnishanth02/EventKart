# I-2.3.2 — Upcoming Events Listing on Organizer Profile

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` row 510
**Scope:** Render the organizer's upcoming events on the public profile page (`/organizers/:slug`). Backend extends the existing public events list with an optional organizer-slug filter; frontend adds a section to the profile page that reuses the existing event card component.

---

## Goal

Once a participant lands on a verified organizer's profile, they should immediately see what that organizer is running next. This is the second-most-important page in Module 2.3 (after the profile shell from I-2.3.1) and the on-ramp from "this organizer looks legit" to "let me browse and register."

---

## Source of truth

- `docs/requirements.md:234` — F-2.3.2: "Upcoming events listing on organizer profile."
- `docs/v1-implementation-plan.md:510` — I-2.3.2 row.
- Existing infrastructure depended on: I-2.2.1 (`GET /api/v1/events/public`), I-2.2.2 (`<PublicEventCard>`), I-2.3.1 (`<PublicOrganizerProfile>` and the public organizer lookup endpoint).

---

## Approach

**Extend** the existing `GET /api/v1/events/public` endpoint with an optional `organizerSlug` query parameter rather than creating a parallel endpoint. Single source of truth for "public event card listing" — count, batched joins, projection, pagination, sort, and feature flags all stay in one pipeline.

Frontend adds a new section component to the organizer profile page that consumes the same endpoint with the slug filter pinned. The existing `<PublicEventCard>` is reused as-is (no duplication).

---

## Approved design

### 1. Backend — extend `GET /api/v1/events/public`

| File | Change |
| --- | --- |
| `apps/api/src/modules/events/schemas.ts` | Add `organizerSlug: organizerSlugSchema.optional()` to `publicEventListQuerySchema` (imported from `@repo/shared/schemas`). |
| `apps/api/src/modules/events/public-listing-service.ts` | `PublicEventListingParams` gains `organizerSlug?: OrganizerSlug`. `selectListingRows` conditionally appends `events.organizerId IN (SELECT id FROM organizers WHERE slug = $1)` to the shared `WHERE` used by **both** the COUNT and the rows query. |
| `apps/api/src/modules/events/routes.ts` | No code change — the existing `{ ...request.query, now: new Date() }` spread already forwards the parsed `organizerSlug`. |

Subquery chosen over JOIN so the existing test mock (which exposes `from → where → orderBy → limit → offset`) continues to work without growing an `innerJoin` method. Postgres still optimizes via the unique `organizers_slug_unique` index. The branded `OrganizerSlug` flows through the SQL parameter cleanly as a string.

### 2. Frontend — `apps/web/src/features/organizer-detail/`

| File | Purpose |
| --- | --- |
| `upcoming-events-api.server.ts` | `getOrganizerUpcomingEventsOnServer({ organizerSlug, page, limit, sort })` — calls `/events/public?organizerSlug=…&page=…&limit=…&sort=…` via `serverApiClient`. |
| `upcoming-events-api.ts` | `createServerFn` wrapping the server fetch. Validates input with Zod (`organizerSlug: organizerSlugSchema`, `page: z.number().int().min(1)`, `limit: z.number().int().min(1).max(50)`, `sort: z.enum(["startAtAsc","startAtDesc"])`). |
| `upcoming-events-queries.ts` | `organizerUpcomingEventsQueryOptions(params)` (60 s `staleTime`, 5 min `gcTime`). |
| `components/upcoming-events-section.tsx` | Section component: heading "Upcoming events", anchor `id="upcoming-events"`, 1/2-col responsive grid (`grid-cols-1 md:grid-cols-2`) matching the profile's narrower `max-w-3xl` content width, dashed empty state with organizer name. Reuses `<PublicEventCard>` from events-discovery. |

### 3. Loader integration — `apps/web/src/features/organizer-detail/loader.ts`

Loader return type changed from `OrganizerPublicProfile` to `{ profile, events }`. Events are fetched via `ensureQueryData` **only after** the profile resolves successfully (so the redirect-throw and 404-throw paths from I-2.3.1 still fire first and never trigger an unnecessary events fetch). The events fetch is wrapped with a try/catch — on failure it logs `console.warn` and returns `events: []` so a transient backend hiccup never 500s the profile page.

### 4. Route — `apps/web/src/routes/_public/organizers/$slug.tsx`

`head()` now reads `loaderData.profile`. The route component is split into a thin loader-data adapter and a pure exported `OrganizerDetailView` so the rendering can be unit-tested without mocking the router's loader-data hooks. `OrganizerDetailView` stacks `<PublicOrganizerProfile>` and `<UpcomingEventsSection>` vertically inside the shared profile container.

---

## Decisions

| ID  | Decision                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Extend `/events/public` rather than add a new endpoint.** Single pipeline → no duplicated count/projection logic → cache-key naturally varies on URL.                                                           |
| D2  | **Filter by `organizerSlug` (public identifier), not `organizerId`.** Matches the public profile route params and never leaks the internal organizer UUID. (Per I-2.3.1 D1: slug is the public identifier.)       |
| D3  | **Subquery over JOIN.** Keeps the existing 12 listing-service tests passing without modifying the test mock (no `innerJoin` method needed). Postgres optimizes via the unique slug index either way.              |
| D4  | **Unknown slug → empty result, not 404.** Profile page already 404'd at slug lookup; a second 404 on the events list would be confusing. Empty result is also the natural happy path for new organizers.          |
| D5  | **No pagination UI on the profile page.** V1 caps at `limit=12` (3-row × 4-col is overkill for the narrow profile column; 2-col × 6-row is fine). Pagination controls deferred — most organizers run < 12 active. |
| D6  | **`startAtAsc` default.** Soonest first matches user intent on a profile page.                                                                                                                                    |
| D7  | **Loader prefetches events in series after the profile resolves.** This guarantees that redirect/404 throws fire first and never trigger an unnecessary events fetch.                                             |
| D8  | **Resilience: events failure → empty array, not 500.** Profile must always render even if the events backend is degraded.                                                                                         |
| D9  | **Heading "Upcoming events" (not "Upcoming events from {name}").** The page is already scoped to the organizer; restating the name is redundant.                                                                  |
| D10 | **`OrganizerDetailView` exported as a pure component.** Tests render it directly with a query-client wrapper instead of mocking router loader-data hooks.                                                         |

---

## Files changed

### Created
- `apps/web/src/features/organizer-detail/upcoming-events-api.server.ts`
- `apps/web/src/features/organizer-detail/upcoming-events-api.ts`
- `apps/web/src/features/organizer-detail/upcoming-events-queries.ts`
- `apps/web/src/features/organizer-detail/components/upcoming-events-section.tsx`
- `apps/web/src/features/organizer-detail/components/upcoming-events-section.test.tsx` (5 tests)
- `apps/web/src/features/organizer-detail/loader.test.ts` (5 tests)

### Modified
- `apps/api/src/modules/events/schemas.ts` — `organizerSlug` added to `publicEventListQuerySchema`.
- `apps/api/src/modules/events/public-listing-service.ts` — `organizerSlug` filter on count + rows queries.
- `apps/api/test/modules/events/public-listing.test.ts` — +9 new tests (filter applied to count + rows, no filter when omitted, happy path filtered listing, unknown slug → empty meta, pagination math at page 1/3, `startAtDesc` ordering preserved, `published` status filter preserved, `endAt > now` filter preserved).
- `apps/api/test/modules/events/routes.test.ts` — +2 tests (`organizerSlug=@bad!` → 400; valid slug forwards to service).
- `apps/web/src/features/organizer-detail/loader.ts` — return type now `{ profile, events }`; resilient events fetch.
- `apps/web/src/routes/_public/organizers/$slug.tsx` — head reads `loaderData.profile`; route split into pure exported `OrganizerDetailView`.
- `apps/web/src/routes/_public/organizers/$slug.test.tsx` — updated query-client harness for new return shape; added route-level tests for cards-present and empty-state cases.

---

## Test inventory

### API
- 9 new tests in `apps/api/test/modules/events/public-listing.test.ts` covering filter SQL composition, omission semantics, happy path, unknown slug, pagination math, sort, status, and `endAt` filtering.
- 2 new tests in `apps/api/test/modules/events/routes.test.ts` covering the route-layer 400 for invalid slug shape and the parameter forwarding.

### Web
- 5 new section tests (`upcoming-events-section.test.tsx`): heading, anchor id, empty state with organizer name, cards rendered per event, narrower grid CSS.
- 5 new loader tests (`loader.test.ts`): happy path returns `{ profile, events }`; events fetch failure → `events: []` + `console.warn`; redirect path skips events fetch; 404 path skips events fetch; cache headers written after both fetches.
- Route-level rendering tests in `$slug.test.tsx` updated for the new loader shape; new cases for cards-present and empty-state rendering.

---

## Validation evidence

```
pnpm --filter @repo/shared check-types  → exit 0
pnpm --filter api check-types           → exit 0
pnpm --filter api test                  → 831/831 (+11 from 820)
pnpm --filter api lint                  → exit 0
pnpm --filter web check-types           → exit 0
pnpm --filter web test                  → 507/507 (+12 from 495)
pnpm --filter web lint                  → exit 0
```

---

## Out of scope (deferred)

- I-2.3.3 — Past event history on profile (will reuse the same endpoint with a `pastOnly` / `endedBefore` filter or a `status: "ended"` discriminator — a parallel small extension).
- I-2.3.6 — Same-organizer next-event API (different shape: `GET /organizers/{organizerId}/next-event`, used by post-event emails).
- Pagination controls on the profile page — V1 caps at `limit=12`. Most organizers in the Coimbatore launch density target run fewer than 12 active events.
- Filtering by category / city on the profile page — the dedicated event-discovery page (`/`) is the place for that.
- Cross-organizer next-event discovery — deferred to product-plan §8 Layer 5 post-V1.

---

## Workflow notes

- Followed `.github/prompts/eventkart-dev-workflow.prompt.md`. Backend + frontend dispatched as parallel background sub-agents (contract-driven against an optional `organizerSlug` query param).
- Skipped Plan Review and Code Review phases per the "Escape Hatch (small reversible work)" rule — single optional query param + section component composing existing primitives. The change is fully covered by deterministic mock-DB unit tests (backend) and TanStack Query tests (frontend).
- One subtle UX choice: events fetch failure swallowed with `events: []` rather than rendering an inline error banner. V1 ships the simpler resilient path; an inline retry affordance can be layered on later if observability shows the events endpoint is unstable.
