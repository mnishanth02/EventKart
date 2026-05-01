# I-2.3.6 — Same-Organizer Next-Event Lookup API

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` row 512
**Scope:** Internal-only `GET /api/v1/organizers/{organizerId}/next-event` returning the organizer's immediate next published event (or `null`), consumed by the I-6.2.3 post-event email worker. Backend only — no frontend changes.

---

## Goal

When a participant finishes an event, the I-6.2.3 thank-you email worker needs to surface "your next event from {organizer}" if one exists. This issue ships the lookup primitive that worker will call. **V1 scope is same-organizer only** — cross-organizer next-event discovery is deferred to product-plan §8 Layer 5 post-V1 (after the Coimbatore density target of 15+ organizers per §10).

---

## Source of truth

- `docs/requirements.md` — F-2.3.6 (next-event API consumed by post-event email).
- `docs/v1-implementation-plan.md:512` — I-2.3.6 row.
- Deps: I-2.3.1 (`organizers` table + slug/profile model), I-1.2.1 (`listPublicEvents` pipeline), I-1.2.6 (internal-key plugin / `request.isInternalRequest`).

---

## Approach

**Reuse** the I-2.3.2/I-2.3.3 listing pipeline. The only mechanical work is:

1. Add an optional `organizerId?: string` filter to `PublicEventListingParams` (parallel to the existing `organizerSlug` filter — direct equality on `events.organizer_id` instead of a subquery, since we already have the UUID).
2. Wrap `listPublicEvents` with `selectOrganizerNextEvent` that pins `limit=1`, `sort=startAtAsc`, `timeWindow=upcoming`, then returns the first card or `null`.
3. Mount as a route protected by a new `requireInternal` preHandler (the first **enforcement** consumer of `request.isInternalRequest`).

---

## Approved design

### 1. New auth gate — `apps/api/src/middleware/require-internal.ts`

A small Fastify preHandler. Throws `UnauthorizedError("Internal API key required")` if `!request.isInternalRequest`. The existing `internal-key` plugin (`apps/api/src/plugins/internal-key.ts`) already validates `x-internal-key` against `config.INTERNAL_API_KEY` via `timingSafeEqual` and sets the boolean opt-in; this middleware enforces the opt-in. Reusable for any future internal-only endpoint.

### 2. Backend filter extension

| File | Change |
| --- | --- |
| `apps/api/src/modules/events/public-listing-service.ts` | `PublicEventListingParams` gains optional `organizerId?: string`. `selectListingRows` adds `eq(events.organizerId, params.organizerId)` to the conditions array AFTER the existing `organizerSlug` subquery block. Applied to BOTH the count and rows queries to keep pagination meta correct (even though the next-event wrapper only needs the first row). |

### 3. Service wrapper — `apps/api/src/modules/organizer/next-event-service.ts`

Two exports:

- `selectOrganizerNextEvent(deps, { organizerId, now })` → wraps `listPublicEvents` with `{ organizerId, page: 1, limit: 1, sort: "startAtAsc", timeWindow: "upcoming" }`. Returns `data[0] ?? null`. `deps.storage` is required because `listPublicEvents` builds full `EventPublicCard` rows including `heroImage` via `toPublicImage`.
- `organizerExistsById(db, organizerId)` → cheap `select id from organizers where id = $1 limit 1` for the 404 distinguisher.

### 4. Route — `apps/api/src/modules/organizer/routes.ts`

```
GET /:organizerId/next-event
  preHandler: [requireInternal]
  params: organizerIdParamsSchema (z.string().uuid())
  response.200: { success: true, data: EventPublicCard | null }
```

Route ordering: registered after `/by-slug/:slug` and after the static `me`/`policies`/`documents`/`verification-status` routes; Fastify's static-segment-wins routing keeps it from shadowing them. Existence check runs first — missing organizer → `NotFoundError` (404). Otherwise calls `selectOrganizerNextEvent` and returns `{ success: true, data: card | null }`.

### 5. Schemas — `apps/api/src/modules/organizer/schemas.ts`

```ts
export const organizerIdParamsSchema = z.object({
  organizerId: z.string().uuid(),
});
export const organizerNextEventResponseSchema = z.object({
  success: z.literal(true),
  data: eventPublicCardSchema.nullable(),
});
```

`eventPublicCardSchema` is imported from `@repo/shared/schemas/event-public-card` — reused, NOT redefined.

---

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **URL = `/:organizerId/next-event` with UUID** (per v1-plan row 512). Not slug — the consumer (I-6.2.3 email worker) already has the organizer's `id` from the registration row; making it look it up via slug would be wasted work and a pointless DB hop.       |
| D2  | **Auth: new `requireInternal` preHandler.** Throws `UnauthorizedError` if `!request.isInternalRequest`. The existing `internal-key` plugin is opt-in (no default-deny, so other public endpoints aren't affected); this middleware enforces the opt-in. Reusable. |
| D3  | **"Next" definition: `status = 'published' AND endAt > now`, `ORDER BY startAt ASC, id ASC`, `LIMIT 1`.** Matches the existing upcoming-events predicate (consistent with `?timeWindow=upcoming`). `id ASC` provides a deterministic tiebreaker.                  |
| D4  | **Response shape: `{ success: true, data: EventPublicCard \| null }`.** Reuses the canonical shared `eventPublicCardSchema` so the worker gets the exact same projection the public listing returns — heroImage, pricing, capacity, the lot.                      |
| D5  | **Organizer-not-found → 404; organizer-with-no-upcoming → `data: null`.** Two distinct outcomes the email worker must distinguish: a typo in `organizerId` is an operational bug (bubble it up), but "you have no upcoming events" is the legitimate empty state. |
| D6  | **Reused `listPublicEvents` rather than writing a bespoke single-row query.** Keeps "what counts as a public event card" defined in exactly one place (status union, hero-image fallback, pricing tier projection, etc.) and free-rides on its 30+ existing tests.|
| D7  | **`organizerSlug` and `organizerId` are mutually exclusive in practice** — the route never passes both. Both filters compose (AND) if a future caller passes both, which is harmless: an organizer's slug always maps to the same id.                              |
| D8  | **Service helper lives in `apps/api/src/modules/organizer/next-event-service.ts`** (not `events/`). The endpoint is hung off the organizer module, so its primary owner is organizer too. This keeps domain ownership clear.                                       |
| D9  | **Test target: ≥10 new tests** (5 service + 4 route + 1 middleware-style auth) plus 2 listing-service filter tests. Covers all 6 documented behaviors above. Final count: 14 new tests, 838 → 852.                                                                |
| D10 | **No frontend code in this issue.** The endpoint's only consumer is the I-6.2.3 server-side worker; there's no SSR or client surface to wire. Anything else would be scope creep.                                                                                  |

---

## Files changed

### Created
- `apps/api/src/middleware/require-internal.ts` — `requireInternal` preHandler.
- `apps/api/src/modules/organizer/next-event-service.ts` — `selectOrganizerNextEvent`, `organizerExistsById`.
- `apps/api/test/modules/organizer/next-event.test.ts` — 10 tests (4 route auth/validation/404, 2 happy path, 1 short-circuit, 3 service unit).

### Modified
- `apps/api/src/modules/events/public-listing-service.ts` — `PublicEventListingParams` gains `organizerId?: string`; `eq(events.organizerId, ...)` appended to conditions and applied to both count + rows queries.
- `apps/api/src/modules/organizer/schemas.ts` — added `eventPublicCardSchema` import; new `organizerIdParamsSchema` and `organizerNextEventResponseSchema`.
- `apps/api/src/modules/organizer/routes.ts` — added `requireInternal` import + schema + service imports; registered `GET /:organizerId/next-event` after the `/by-slug/:slug` route.
- `apps/api/test/modules/events/public-listing.test.ts` — +4 tests in a new `describe("listPublicEvents — organizerId filter")` block (predicate applies to both queries, omitted by default, returns the single row, returns empty when none).

---

## Test inventory

### `apps/api/test/modules/organizer/next-event.test.ts` (10 new tests)

**Route — auth (2):**
1. 401 when `x-internal-key` header is missing.
2. 401 when `x-internal-key` value does not match.

**Route — validation (1):**
3. 400 when `organizerId` is not a UUID.

**Route — happy path (2):**
4. 200 with the next event card when one exists (full mock chain: existence probe → count → rows → batched categories/pricing/images).
5. 200 with `data: null` when the organizer has no upcoming events.

**Route — not found (1):**
6. 404 when the organizer does not exist (existence probe returns `[]`).

**Route — short-circuit (1):**
7. `organizerExistsById` returning `[]` skips the `listPublicEvents` queries entirely (asserts `db.select` called exactly once).

**Service unit (3):**
8. `selectOrganizerNextEvent` returns the first card when listing yields a row.
9. `selectOrganizerNextEvent` returns `null` when listing yields zero rows.
10. `selectOrganizerNextEvent` pins `limit=1` / `offset=0` on the rows query (asserts the wrapper forwards correctly).

### `apps/api/test/modules/events/public-listing.test.ts` (4 new tests)

11. Applies `events.organizer_id` predicate to BOTH count and rows queries.
12. Does NOT add the predicate when `organizerId` is omitted.
13. Returns the organizer's single next event when `limit=1`.
14. Returns empty data + zeroed meta when the organizer has no upcoming events.

---

## Validation evidence

```
pnpm --filter @repo/shared check-types  → exit 0
pnpm --filter api check-types           → exit 0
pnpm --filter api test                  → 852/852 (+14 from 838)
pnpm --filter api lint                  → exit 0 (9 pre-existing warnings)
```

No web changes → web check-types/test/lint deliberately skipped.

---

## Out of scope (deferred)

- **Cross-organizer next-event discovery** — explicit V1 scope boundary per row 512. Belongs to product-plan §8 Layer 5 post-V1.
- **Geographic / category filters** on the next-event lookup — the email worker only needs same-organizer.
- **Caching the lookup** — the worker batches sends; per-organizer overhead is one query per email. Premature optimization.
- **Public exposure of this endpoint** — it stays internal-only for V1; if a public "your next event" surface is ever needed it should be a different endpoint with its own rate limiting and cache contract.

---

## Workflow notes

- Followed `.github/prompts/eventkart-dev-workflow.prompt.md`. Implementation done directly in the main agent (not via background sub-agents) because the scope was small (~250 LOC) and entirely backend.
- The `requireInternal` middleware is now the canonical pattern for internal-only endpoints. Future internal endpoints should reuse it rather than re-implementing `if (!request.isInternalRequest) throw …`.
- Test mock evolution: the existing public-listing test mock indexes "which method terminates the chain" by query position. That assumption broke when the next-event route added an existence probe at index 0. The next-event tests use an explicit `[rows, terminal]` tuple — `terminal: "limit" | "offset" | "orderBy"` — which makes each query's terminal method explicit and is robust to call-order shifts. Worth considering for any future test that adds queries upstream of the listing pipeline.
