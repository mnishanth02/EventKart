# I-2.3.3 — Past Event History on Organizer Profile

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` row 511
**Scope:** Render the organizer's past events on the public profile page (`/organizers/:slug`), below the upcoming-events section. Builds organizer credibility for prospective participants.

---

## Goal

Once a participant lands on a verified organizer's profile (I-2.3.1) and scans the upcoming events (I-2.3.2), the next signal of legitimacy is **track record** — what has this organizer actually run? Past events are the primary social proof on the profile.

---

## Source of truth

- `docs/requirements.md:235` — F-2.3.3: "Past event history on organizer profile."
- `docs/v1-implementation-plan.md:511` — I-2.3.3 row.
- Builds on I-2.3.1 (`<PublicOrganizerProfile>` + loader scaffolding) and I-2.3.2 (`organizerSlug` filter on `GET /api/v1/events/public`, `<UpcomingEventsSection>` pattern). Reuses I-2.2.2 `<PublicEventCard>`.

---

## Approach

**Extend** the same `GET /api/v1/events/public` endpoint with a `timeWindow` discriminator (`"upcoming" | "past"`, default `"upcoming"`) so the existing `listPublicEvents` pipeline (count + batched joins + projection + pagination + sort) serves both lists. Compose with the I-2.3.2 `organizerSlug` filter. Frontend mirrors the I-2.3.2 file layout — small intentional duplication keeps the diff surgical.

---

## Approved design

### 1. Backend — extend `GET /api/v1/events/public`

| File | Change |
| --- | --- |
| `apps/api/src/modules/events/schemas.ts` | Add `timeWindow: z.enum(["upcoming", "past"]).default("upcoming")` to `publicEventListQuerySchema`. |
| `apps/api/src/modules/events/public-listing-service.ts` | `PublicEventListingParams` gains required `timeWindow`. `selectListingRows` switches the time + status predicates: upcoming → `endAt > now` AND `status = 'published'`; past → `endAt <= now` AND `status IN ('published','completed')`. The I-2.3.2 organizer-slug subquery composes after, applied to BOTH the count and rows queries. |
| `packages/db/src/index.ts` | One-line additive: `export type { SQL }` so the listing-service conditions array gets a static type without an inline `import type` from drizzle. |
| `apps/api/src/modules/events/routes.ts` | No code change — the existing `{ ...request.query, now: new Date() }` spread already forwards the parsed `timeWindow`. |

### 2. Frontend — `apps/web/src/features/organizer-detail/`

| File | Purpose |
| --- | --- |
| `past-events-api.server.ts` | `getOrganizerPastEventsOnServer({ organizerSlug, page, limit, sort })` — calls `/events/public?organizerSlug=…&timeWindow=past&...` via `serverApiClient`. |
| `past-events-api.ts` | `createServerFn({ method: "GET" })` wrapping the server fetch. Same Zod input validator as upcoming (`organizerSlug: organizerSlugSchema`, `page≥1`, `limit 1-50`, `sort enum`). Lazy server-imports the `.server` module. |
| `past-events-queries.ts` | `organizerPastEventsQueryOptions(params)` keyed `["organizer-past-events","list",params]`. 60s `staleTime` / 5min `gcTime`. |
| `components/past-events-section.tsx` | Section component: heading "Past events", anchor `id="past-events"`, 1/2-col grid (matches the profile's `max-w-3xl` width), dashed empty state with organizer name. Reuses `<PublicEventCard>`. |

### 3. Loader integration — `apps/web/src/features/organizer-detail/loader.ts`

Loader return type extended:
```ts
export interface PublicOrganizerLoaderData {
  profile: OrganizerPublicProfile;
  upcomingEvents: EventPublicCard[];
  pastEvents: EventPublicCard[];
}
```

After the profile resolves successfully, both event fetches run **concurrently** via `Promise.all`:
```ts
const [upcomingEvents, pastEvents] = await Promise.all([
  fetchUpcomingEventsResilient(queryClient, profile.slug),
  fetchPastEventsResilient(queryClient, profile.slug),
]);
```

Each fetch is wrapped in its own resilience helper (try/catch → `console.warn` → returns `[]`). Redirect/notFound throw paths still execute BEFORE either fetch runs. SSR cache headers are written AFTER all three fetches succeed.

### 4. Route — `apps/web/src/routes/_public/organizers/$slug.tsx`

`OrganizerDetailRouteComponent` and `OrganizerDetailView` destructure `{ profile, upcomingEvents, pastEvents }` (renamed from `events`). View JSX stacks Upcoming above Past inside the existing `max-w-3xl` container with `space-y-12` separation.

---

## Decisions

| ID  | Decision                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Extend `/events/public` rather than add a new endpoint.** Same rationale as I-2.3.2 D1 — single pipeline, single source of truth, cache key naturally varies on URL. `timeWindow` is the discriminator.                              |
| D2  | **`timeWindow` defaults to `"upcoming"`.** Backward compatible: every pre-I-2.3.3 caller (homepage, organizer profile upcoming) keeps working without code change.                                                                     |
| D3  | **Status union expands for past: `('published','completed')`.** Mirrors `isPubliclyVisibleStatus` (`public-detail-service.ts:119`, `service.ts:222`). Once admin/cron transitions a past event to `completed`, it must STILL appear in history. `cancelled`, `draft`, `under_review` remain hidden. |
| D4  | **Past sort: `startAtDesc`** so the most recent past event leads. The frontend pins this; the backend default stays `startAtAsc` to avoid surprising other future callers.                                                             |
| D5  | **No pagination UI in V1.** Both lists cap at `limit=12`. Pagination controls deferred — most organizers in the Coimbatore launch density target run fewer than 12 active or recent events.                                            |
| D6  | **Heading "Past events" (not "Past events from {name}").** Page is already scoped to the organizer; restating the name is redundant.                                                                                                  |
| D7  | **Empty state always rendered.** Copy: `"{name} hasn't run any past events yet."` (straight ASCII apostrophe per house style). Consistent with the upcoming-events empty state — never magical hiding.                                 |
| D8  | **Mirror file naming, don't generalize.** Created parallel `past-events-{api.server,api,queries}.ts` files instead of renaming/generalizing the I-2.3.2 `upcoming-events-*` modules. Small intentional duplication keeps this PR surgical and reversible. |
| D9  | **Loader fetches both lists in parallel via `Promise.all`.** Saves SSR latency. Each is wrapped in its own resilience helper so a transient failure in one cannot kill the page or affect the other. Redirect/404 still throws before either fetch. |
| D10 | **Loader return field rename: `events` → `upcomingEvents`.** Now that we have two lists, the unqualified name is ambiguous. I-2.3.2 just shipped, so the rename surface was tiny (only `$slug.tsx` and its test file consumed `events`). |

---

## Files changed

### Created
- `apps/web/src/features/organizer-detail/past-events-api.server.ts`
- `apps/web/src/features/organizer-detail/past-events-api.ts`
- `apps/web/src/features/organizer-detail/past-events-queries.ts`
- `apps/web/src/features/organizer-detail/components/past-events-section.tsx`
- `apps/web/src/features/organizer-detail/components/past-events-section.test.tsx` (5 tests)

### Modified
- `packages/db/src/index.ts` — re-export `type { SQL }` from drizzle-orm.
- `apps/api/src/modules/events/schemas.ts` — `timeWindow` added to `publicEventListQuerySchema`.
- `apps/api/src/modules/events/public-listing-service.ts` — `timeWindow` switches time + status predicates; `organizerSlug` subquery composes after.
- `apps/api/test/modules/events/public-listing.test.ts` — added `timeWindow: "upcoming"` to the shared `params` const for all existing tests; +5 new tests in a `describe("listPublicEvents — timeWindow filter")` block.
- `apps/api/test/modules/events/routes.test.ts` — +1 case in the invalid-query `it.each` (`timeWindow=tomorrow` → 400), +1 forwards-to-service test for valid `timeWindow=past`.
- `apps/web/src/features/organizer-detail/loader.ts` — return type now `{ profile, upcomingEvents, pastEvents }`; `Promise.all` parallel fetch; new `fetchPastEventsResilient`; new `PAST_EVENTS_LIMIT` constant.
- `apps/web/src/features/organizer-detail/loader.test.ts` — rewritten harness now dispatches on `"organizer-past-events"` query-key prefix; existing tests updated for the renamed return shape; +2 new tests (past failure isolated, both fail → both `[]` + 2 warnings).
- `apps/web/src/routes/_public/organizers/$slug.tsx` — destructure renamed; view stacks Upcoming above Past with `space-y-12`.
- `apps/web/src/routes/_public/organizers/$slug.test.tsx` — harness updated for new return shape; +2 route-level render tests.

---

## Test inventory

### API
- 5 new tests in `apps/api/test/modules/events/public-listing.test.ts`:
  1. `omits timeWindow filter for upcoming default` — WHERE uses `endAt > now` AND `status = 'published'`.
  2. `applies past predicate when timeWindow=past` — WHERE uses `endAt <= now` AND `status IN ('published','completed')`.
  3. `composes with organizerSlug` — both filters appear in the WHERE.
  4. `applies past filter to BOTH count and row queries` — dual-query application (mirrors I-2.3.2 dual-application test).
  5. `returns empty meta for past with no matching rows`.
- 2 new tests in `apps/api/test/modules/events/routes.test.ts`:
  - `timeWindow=tomorrow` → 400 (added to existing `it.each`).
  - `forwards timeWindow=past to the service when provided`.

### Web
- 5 new section tests (`past-events-section.test.tsx`): heading + anchor id, cards rendered per event, dashed empty state with exact organizer name, straight-apostrophe regression guard, 1/2-col grid CSS.
- 2 new loader tests (`loader.test.ts`): past failure isolated from upcoming success (one warn), both fail → both `[]` (two warns). Existing 5 tests updated to reflect the new return shape and the `Promise.all` parallel call pattern.
- 2 new route-level render tests in `$slug.test.tsx`: both sections render together, past empty alongside upcoming list.

---

## Validation evidence

```
pnpm --filter @repo/shared check-types  → exit 0
pnpm --filter api check-types           → exit 0
pnpm --filter api test                  → 838/838 (+7 from 831)
pnpm --filter api lint                  → exit 0 (9 pre-existing warnings)
pnpm --filter web check-types           → exit 0
pnpm --filter web test                  → 516/516 (+9 from 507)
pnpm --filter web lint                  → exit 0
```

---

## Out of scope (deferred)

- Pagination controls on either profile-page list — V1 caps both at `limit=12`.
- Filtering past events by year / category / city on the profile page — the dedicated discovery page is the right home for those facets if needed later.
- Aggregated organizer stats (total events run, average rating, etc.) — separate post-V1 product work.
- Cross-organizer past-event discovery — deferred to product-plan §8 Layer 5 post-V1.

---

## Workflow notes

- Followed `.github/prompts/eventkart-dev-workflow.prompt.md`. Backend + frontend dispatched as parallel background sub-agents against the contract `?timeWindow=upcoming|past&organizerSlug=…`.
- Skipped Plan Review and Code Review phases per the "Escape Hatch (small reversible work)" rule — single new enum query param + a near-identical mirror of the I-2.3.2 frontend wiring. Fully covered by deterministic mock-DB unit tests (backend) and TanStack Query tests (frontend).
- Same resilience pattern as I-2.3.2: each events fetch swallows transient failures into an empty list with `console.warn`, so the profile page always renders even if either backend list is degraded. The two lists fail independently.
- The `events` → `upcomingEvents` loader rename was a one-day window opportunity (I-2.3.2 just shipped 2026-04-30 morning); doing it now avoids permanently leaving an ambiguous field name in place.
