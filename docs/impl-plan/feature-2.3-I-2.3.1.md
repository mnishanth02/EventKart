# I-2.3.1 — Public Organizer Profile Page

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` row 508
**Scope:** Public SSR profile page at `/organizers/:slug` showing business name, city, verification badge, and self-authored description.

---

## Goal

Ship the first public-facing organizer surface so prospective participants can verify an organizer's legitimacy before purchasing tickets. The route is the anchor for the rest of Module 2.3 (I-2.3.2 upcoming events, I-2.3.3 past events, I-2.3.4 verification copy) and the target of slug-redirect 301s once the organizer renames.

---

## Architecture (mirror of I-2.1.1 event-detail)

| Layer    | File                                                           | Responsibility                                                                                                                                              |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared   | `packages/shared/src/schemas/organizer-public-profile.ts`      | Canonical Zod projection + discriminated lookup union + HTTP envelope.                                                                                      |
| API lib  | `apps/api/src/lib/text-truncate.ts`                            | Surrogate-safe `truncateNoSurrogateSplit` shared by events + organizer services.                                                                            |
| API      | `apps/api/src/modules/organizer/public-profile-service.ts`     | `lookupPublicOrganizerBySlug(db, rawSlug, log)` — slug validation → direct lookup → verified slug-redirect → 404. PII projection through schema `.parse()`. |
| API      | `apps/api/src/modules/organizer/routes.ts`                     | Anonymous `GET /by-slug/:slug` registered first; response schema strips out-of-shape data at framework boundary.                                            |
| Web      | `apps/web/src/features/organizer-detail/`                      | Feature folder: types, cache-headers, api.server, api (createServerFn), queries, loader, seo, components.                                                   |
| Web      | `apps/web/src/routes/_public/organizers/$slug.tsx`             | SSR route wired to loader + `head()` + `<PublicOrganizerProfile>`.                                                                                          |

**Reuse:** `VerifiedBadge` (`packages/ui/src/components/verified-badge.tsx`), `organizerSlugSchema` (I-2.3.5), `slug_redirects` table (W1.1).

---

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Do NOT expose `organizer.id`** publicly. Slug is the public identifier; downstream features (I-2.3.2/I-2.3.6) query by slug.                                                                                                                                                                                                                                    |
| D2  | **Render unverified organizers** (404 only on missing slug). Add `<meta name="robots" content="noindex,nofollow">` head meta when `isVerified === false` so unverified profiles don't get indexed by search engines.                                                                                                                                              |
| D3  | **Lift `truncateNoSurrogateSplit`** from `events/public-detail-service.ts` to `apps/api/src/lib/text-truncate.ts` so both services share the surrogate-safe boundary logic.                                                                                                                                                                                       |
| D4  | **Description rendered via `<p className="whitespace-pre-line">`** — text node only, no `dangerouslySetInnerHTML`. The DB column is unbounded `text`; combined with the API's 2000-char truncation and CSS-only newline preservation, this gives full XSS isolation.                                                                                              |
| D5  | **Slug validation throws 400** at both layers. The web `createServerFn` Zod validator (`organizerSlugSchema`) is canonical for SSR navigations; the API also rejects independently with `ValidationError`.                                                                                                                                                        |
| D6  | **CDN cache `s-maxage=60, stale-while-revalidate=300`** matches event-detail. Documented as cache-stale follow-up for I-2.4.2 (CDN purge integration).                                                                                                                                                                                                            |
| D7  | **Canonical schema location:** new `organizer-public-profile.ts` defines `organizerPublicProfileSchema`; `event-public-detail.ts` re-exports it as `eventPublicOrganizerSummarySchema` (alias) so the embedded organizer summary on `/events/:slug` and the standalone `/organizers/:slug` profile cannot drift.                                                  |
| D8  | **Verify slug-redirect target** before issuing 301. After finding a `slug_redirects` row, look up the target organizer by `resourceId` and confirm its current slug equals `redirect.newSlug`; if either check fails, 404 instead of dispatching a stale redirect. Mirrors `events/public-detail-service.ts:lookupSlugRedirect`.                                  |
| D9  | **Duplicate small SEO helpers** (`normalizeDescription`, `truncateGraphemes`) inside `organizer-detail/seo.ts` rather than refactoring `event-detail/seo.ts`. Avoids risking the 25 existing event-detail seo.test.ts cases for ~25 lines of duplication.                                                                                                         |
| D10 | **Cache-stale window** (60s fresh, 5min SWR) acceptable for V1 for verification flips, slug renames, and city/description edits. Documented as I-2.4.2 (CDN purge) follow-up — full SEO sweep is its own feature.                                                                                                                                                 |

---

## Rubber-duck critique (all 6 findings adopted)

1. **Critical-1: Verify redirect target.** Don't trust the `slug_redirects` row alone — also verify the target organizer still exists and its current slug matches. **Adopted** (`lookupOrganizerSlugRedirect` in `public-profile-service.ts`).
2. **Critical-2: PII projection contract.** Test by parsing through `organizerPublicProfileSchema` AND asserting exact key set. Wire the schema as Fastify response to strip drift at the framework boundary. **Adopted** (route schema + key-set test + PII-leak fixture covering `id`, `userId`, `contactEmail`, `contactName`, `contactPhone`, `reviewedBy`, `reviewedAt`, `razorpayAccountStatus`, `razorpayRawStatus`, `razorpayLastError`, `razorpayLastSyncedAt`, `createdAt`, `updatedAt`).
3. **Web validation alignment.** `createServerFn` validator may reject before API; route-level test for invalid slug SSR. **Adopted** (route loader test for `@bad!`/`UPPER`/`""`).
4. **Cache-stale risk.** Affects verification badge / noindex / city / description, not just business name — document for I-2.4.2. **Adopted** (D10).
5. **Schema duplication.** `organizerPublicProfileSchema` duplicated `eventPublicOrganizerSummarySchema` — make one canonical. **Adopted** (D7).
6. **Reuse `normalizeDescription`** for bidi/control-char defense in organizer SEO meta. **Adopted as duplication (D9)** — same helper logic, kept in organizer-detail/seo.ts to avoid risking event-detail tests.

---

## Files changed

### Created
- `packages/shared/src/schemas/organizer-public-profile.ts`
- `apps/api/src/lib/text-truncate.ts`
- `apps/api/src/modules/organizer/public-profile-service.ts`
- `apps/api/test/modules/organizer/public-profile.test.ts` (14 tests)
- `apps/web/src/features/organizer-detail/types.ts`
- `apps/web/src/features/organizer-detail/cache-headers.ts`
- `apps/web/src/features/organizer-detail/api.server.ts`
- `apps/web/src/features/organizer-detail/api.ts`
- `apps/web/src/features/organizer-detail/queries.ts`
- `apps/web/src/features/organizer-detail/loader.ts`
- `apps/web/src/features/organizer-detail/seo.ts` (+ `seo.test.ts`, 24 tests)
- `apps/web/src/features/organizer-detail/components/PublicOrganizerProfile.tsx` (+ `.test.tsx`, 7 tests)

### Modified
- `packages/shared/src/schemas/event-public-detail.ts` — `eventPublicOrganizerSummarySchema` is now a re-export alias.
- `packages/shared/src/schemas/index.ts` — exports new organizer-public-profile schemas/types.
- `apps/api/src/modules/events/public-detail-service.ts` — imports `truncateNoSurrogateSplit` from shared lib (inline definition removed).
- `apps/api/src/modules/organizer/schemas.ts` — adds `organizerSlugParamsSchema` + re-export of `organizerPublicLookupHttpResponseSchema`.
- `apps/api/src/modules/organizer/routes.ts` — registers anonymous `GET /by-slug/:slug` first, before any auth-gated route.
- `apps/web/src/features/event-detail/components/public-event-organizer-card.tsx` — raw `<a href>` swapped for typed `<Link to="/organizers/$slug" params={{ slug }}>`; TODO removed.

### Replaced
- `apps/web/src/routes/_public/organizers/$slug.tsx` — placeholder → real SSR route.
- `apps/web/src/routes/_public/organizers/$slug.test.tsx` — placeholder → loader tests (6 tests covering happy path, redirect, notFound, invalid-slug variants).

---

## Test inventory

### Backend (`apps/api/test/modules/organizer/public-profile.test.ts` — 14 tests)
- Happy path: 200 with exact key-set `["businessName","city","description","isVerified","slug"]` + schema parse.
- PII-leak guard: fixture populated with all internal fields → none leak.
- Redirect verified target → 301-equivalent `{kind:"redirect",newSlug}`.
- Redirect target row missing → 404.
- Redirect target exists but its current slug differs from `redirect.newSlug` → 404.
- Redirect loop (`newSlug === slug`) → 404.
- Description: empty string → `null`; whitespace-only → `null`; 3000-char ASCII → truncated to 2000; emoji at boundary 1999 → no dangling surrogate.
- Invalid slug (`@bad slug!`) via `app.inject()` → 400 ValidationError.

### Frontend
- `seo.test.ts` (24): noindex flag on/off, with/without `siteUrl`, control-char and bidi description normalization, truncation past 160 graphemes, null-description social fallback.
- `PublicOrganizerProfile.test.tsx` (7): verified vs unverified rendering, description present/absent, long description.
- `routes/_public/organizers/$slug.test.tsx` (6): happy path render, loader 301 redirect, loader notFound, invalid-slug variants.

---

## Validation evidence

```
pnpm --filter @repo/shared check-types  → exit 0
pnpm --filter @repo/shared test         → 192/192
pnpm --filter api check-types           → exit 0
pnpm --filter api test                  → 820/820
pnpm --filter web check-types           → exit 0
pnpm --filter web test                  → 483/483
pnpm --filter api lint                  → exit 0 (warnings in pre-existing files only)
pnpm --filter web lint                  → exit 0
```

---

## Out of scope (deferred)

- I-2.3.2 — Upcoming events listing on profile.
- I-2.3.3 — Past events on profile.
- I-2.3.4 — Verification copy explainer.
- I-2.3.6 — Same-organizer next-event API.
- I-2.4.2 — CDN purge integration (cache-stale window for verification/profile edits).
- I-2.4.7 — Full SEO sweep (canonical link is included opportunistically).
- JSON-LD `Organization`/`Person` block — task said optional; basic OG/Twitter meta only.

---

## Workflow notes

- Followed `.github/prompts/eventkart-dev-workflow.prompt.md` fleet workflow with the existing anvil agent.
- Phase 1 (shared schema canonicalization + helper extraction) executed in main session.
- Phase 2 (backend + frontend) dispatched in parallel as background sub-agents.
- Phase 3 (validation + tracking docs) executed in main session.
- Rubber-duck critique consulted on the plan before Phase 2 dispatch; all 6 findings adopted.
