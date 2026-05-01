# I-2.4.6: 301 redirect handler for slug changes

**Feature ID:** I-2.4.6
**Module:** 2.4 — SEO sweep
**Status:** ✅ Complete (2026-04-30)
**Dependencies:** I-1.2.10 (event slug rename + `slug_redirects` row),
I-2.3.5 (organizer slug rename + `slug_redirects` row), I-2.1.5 / I-2.3.1
(public detail loaders).
**Related:** I-2.4.5 (canonical SSR cache contract), I-2.4.7 (canonical URL tags).

## Scope

This was largely an **audit-and-tighten** task — the discriminated-union
`{ kind: "event"|"organizer"|"redirect", … }` machinery shipped with
I-1.2.10 / I-2.3.5, and the loaders already throw `redirect({ code: 301 })`
on the redirect arm. The remaining work was to (a) verify each invariant
the slug-redirect contract requires, (b) close the one gap that remained
on the event side, and (c) add the test coverage that locks the
chained-rename and CDN-poisoning hazards down so a future refactor can't
silently regress them.

## Invariant audit

The slug-redirect lookup MUST verify every one of these before issuing a
301, otherwise we either (1) leak a stale slug to the client, (2)
trigger a 404 round-trip after a useless 301 hop, or (3) let the CDN
cache a redirect target that no longer exists. Stored memory:
`slug redirect verification`.

| Invariant | Event side (before audit) | Organizer side | Action |
|---|---|---|---|
| Loop guard `redirect.newSlug !== requestedSlug` | ✅ | ✅ | — |
| Target row exists | ✅ | ✅ | — |
| **Target row's current slug equals `redirect.newSlug`** | ❌ **MISSING** | ✅ | **Gap-fill** |
| Public-visibility status gate (`isPubliclyReadableEventStatus`) | ✅ | n/a (organizer has no `status` column; description sanitized via `truncateNoSurrogateSplit`; schema strips extra fields) | — |
| Discriminated-union zod parse on response | ✅ via `eventPublicSlugRedirectSchema` | ✅ via `organizerPublicSlugRedirectSchema` | — |
| Web loader throws `redirect({ code: 301, replace: true })` | ✅ | ✅ | — |
| `redirectTo` arg threads through child route `/events/$slug/register` | ✅ | n/a (no organizer child route under `/organizers/$slug/*`) | — |
| Cache-Control on the 301 Response (web) | ⚠️ TanStack default | ⚠️ TanStack default | **Gap-fill** |
| Cache-Control on the redirect-payload JSON (API) | ⚠️ Unset | ⚠️ Unset | **Gap-fill** |
| Test for chained rename (target.slug ≠ redirect.newSlug → 404) | ❌ Missing | ✅ Present | **Gap-fill** |

## Gap-fills

### 1. Event service — chained-rename equality assertion

`apps/api/src/modules/events/public-detail-service.ts` ·
`lookupSlugRedirect`. Added `targetEvent.slug !== redirect.newSlug` to
the existence + status guard so the function throws `NotFoundError`
(404) when the redirect target's canonical slug has moved on. Mirrors
the organizer-side guard line-for-line and is documented with the same
"chain rename A → B → C" terminology.

### 2. Web loaders — explicit `Cache-Control` on the 301

`apps/web/src/features/event-detail/loader.ts` and
`apps/web/src/features/organizer-detail/loader.ts`. Each loader now
passes `headers: { "Cache-Control": "public, max-age=300" }` directly
into the `redirect()` call so the 301 Response carries the directive
the CDN edge actually sees. Plain `max-age` only — deliberately **not**
`s-maxage=60, stale-while-revalidate=300` (which is what the 200 path
uses), because SWR on a permanent redirect is a footgun: a follow-up
rename (A → B → C) can let the CDN keep serving the obsolete `→ B`
target through the SWR window, breaking links for up to `s-maxage +
SWR` seconds. Constants `PUBLIC_EVENT_REDIRECT_CACHE_CONTROL` /
`PUBLIC_ORGANIZER_REDIRECT_CACHE_CONTROL` exported so tests assert the
exact directive.

### 3. API routes — explicit `Cache-Control` on the redirect payload

`apps/api/src/modules/events/routes.ts` and
`apps/api/src/modules/organizer/routes.ts`. When `data.kind ===
"redirect"`, the route handler calls `reply.header("cache-control",
"public, max-age=300")` BEFORE returning. Same rationale as (2):
the API JSON response feeds either the SSR loader or the browser
ensureQueryData call, and we don't want a stale `redirect` payload
pinned in any intermediary cache (Cloudflare, fetch, React Query)
across a follow-up rename. The 200/event JSON path is unchanged
(it still ships the I-2.1.1 SSR cache contract).

## Test additions

| File | Added | Locks down |
|---|---|---|
| `apps/api/test/modules/events/public-detail.test.ts` | +27 lines: chained-rename → 404 case + `cache-control: public, max-age=300` assertion on the existing happy-path redirect test | Gap-fill 1 + 3 |
| `apps/api/test/modules/organizer/public-profile.test.ts` | +5 lines: `cache-control: public, max-age=300` assertion on the existing happy-path redirect test | Gap-fill 3 |
| `apps/web/src/features/event-detail/loader.test.ts` | +7 lines: assert `redirectError.options.headers["Cache-Control"]` is `public, max-age=300` | Gap-fill 2 |
| `apps/web/src/features/organizer-detail/loader.test.ts` | +19 lines: assert redirect target route, params, code, replace, AND the `Cache-Control` header (the organizer loader test had only checked `isRedirect(error)` before) | Gap-fill 2 |

The chained-rename safety case (event side) is the one that genuinely
required new test coverage. The organizer side already had the
equivalent test (`"returns 404 when the target organizer's current slug
differs from redirect.newSlug"`) from I-2.3.5 — the new event test was
modelled on it directly so both modules read consistently.

## Design notes

### Chained-rename safety

A single rename A → B leaves a `slug_redirects` row `(oldSlug=A,
newSlug=B, resourceId=event.id)`. A second rename to C inserts a new
row `(oldSlug=B, newSlug=C, resourceId=event.id)` AND updates
`events.slug = C`. The original A → B redirect row is still there.

Without the equality check, a request for `/events/A` would:

1. Miss `events.slug = A` → fall through to the redirect lookup.
2. Find redirect row `(A → B)`, target row exists, status published.
3. **Issue 301 → /events/B**.
4. Browser follows → `/events/B` misses `events.slug = B` → falls through.
5. Finds redirect row `(B → C)`.
6. **Issue 301 → /events/C** (eventually correct, but two hops).

That's tolerable for one extra hop but **gets worse with each rename**,
and at the CDN layer the intermediate `/events/B → /events/C` redirect
itself can be cached with the long `s-maxage` — turning a transient
two-hop chain into a long-lived doormat. Worse, if at step 5 the redirect
table has been compacted (a future cleanup job we may add), step 4 ends
on a 404 instead, and the cached 301 from step 3 keeps sending
clients there.

The equality check `targetEvent.slug === redirect.newSlug` ends the
chain at step 2: if the target row's canonical slug has moved on,
return 404 immediately. The browser will then 404, not chase a stale
hop. The cost is one extra read of `events.slug` (already loaded by
`selectEventById`), so this is free.

### Cache-Control on 301s

The 301 status code is "permanent" — and per RFC 7231 §6.4.2 a 301 is
heuristically cacheable. Cloudflare and most browsers will happily cache
a 301 indefinitely if no `Cache-Control` is set. That's the **wrong
default** for slug-rename redirects: slugs are user-editable, and a
follow-up rename needs the redirect to invalidate quickly. Setting
`Cache-Control: public, max-age=300` caps the cache lifetime at 5
minutes — long enough to absorb a viral inbound link burst, short enough
that a follow-up rename propagates within the same window.

We deliberately **do not** use `s-maxage=60, stale-while-revalidate=300`
(the SSR 200 contract). On a permanent redirect, SWR means the CDN
keeps serving a known-stale redirect target while it asynchronously
revalidates — for up to `s-maxage + SWR = 360s`. On a 200 page that's
acceptable because the worst case is "the user sees a slightly out-of-date
event page". On a 301 the worst case is "the user gets sent to a 404,
or to a different event entirely if slugs were swapped". Plain `max-age`
is the safer primitive here.

### Why the API payload also gets Cache-Control

Three layers see the redirect JSON:

1. The TanStack Start SSR loader (`ensureQueryData` → fetch).
2. React Query's `gcTime`/`staleTime` on the client after hydration.
3. Any fetch-level cache at Cloudflare or in workers.

Layers 1 and 2 are governed by the React Query options
(`publicEventQueryOptions` already sets `staleTime: 30_000`), but layer
3 sees the raw HTTP response and will respect whatever `Cache-Control`
the API sets. Setting `public, max-age=300` on the redirect JSON keeps
layer 3 honest.

## Files touched

| File | Change |
|---|---|
| `apps/api/src/modules/events/public-detail-service.ts` | + chained-rename equality check + jsdoc |
| `apps/api/src/modules/events/routes.ts` | + `cache-control: public, max-age=300` when `data.kind === "redirect"` |
| `apps/api/src/modules/organizer/routes.ts` | + `cache-control: public, max-age=300` when `data.kind === "redirect"` |
| `apps/web/src/features/event-detail/loader.ts` | + `headers: { "Cache-Control": ... }` on `redirect()` + exported constant |
| `apps/web/src/features/organizer-detail/loader.ts` | + `headers: { "Cache-Control": ... }` on `redirect()` + exported constant |
| `apps/api/test/modules/events/public-detail.test.ts` | + chained-rename → 404 test + cache-control assertion |
| `apps/api/test/modules/organizer/public-profile.test.ts` | + cache-control assertion on existing redirect test |
| `apps/web/src/features/event-detail/loader.test.ts` | + cache-control header assertion on redirect option |
| `apps/web/src/features/organizer-detail/loader.test.ts` | + redirect-option assertions including cache-control header |
| `apps/api/src/modules/organizer/public-profile-service.ts` | (unchanged — already had all invariants) |

## Validation

```sh
pnpm --filter api check-types       # ✅ clean
pnpm --filter api test              # ✅ 860 / 860 passed (50 files)
pnpm --filter web check-types       # ✅ clean
pnpm --filter web test              # ✅ 568 passed; 2 pre-existing failures
                                    #    in cache-headers.test.ts (unrelated:
                                    #    isomorphic helper returns undefined
                                    #    on the jsdom client branch — these
                                    #    failures exist on baseline before
                                    #    this slice and are not caused by it)
```

## Rollback

```sh
git revert <commit-sha>              # all changes are additive + test-asserted
```

The chained-rename equality check is the only behavioral change —
reverting it returns the event service to "issue 301 to a possibly
stale slug" behavior (the organizer service was already correct).

## Adversarial review findings (gpt-5.3-codex)

The Anvil adversarial pass surfaced two issues — both noted here for
the record. Neither is fixed in this slice; both are tracked.

### 1. Stale-301 TOCTOU between redirect and target reads (won't-fix)

The reviewer flagged a race window: `lookupSlugRedirect` reads the
`slug_redirects` row, then reads the target `events` row. A concurrent
rename that commits between those two reads (or after the target read,
but before the client follows the 301) can still cause a 301 to a
slug that no longer exists.

**Decision:** Won't-fix in this slice. This is a fundamental property
of any 301 — the target can change after the redirect is issued, no
matter how tightly we lock the lookup. The mitigations are already in
place: (a) the chained-rename equality check ends the chain at the
known-stale case (the most common race outcome), (b) `max-age=300`
caps the client/CDN cache lifetime so any stale 301 self-heals within
5 minutes, (c) the equality check uses `selectEventById` which is the
fresher of the two reads. The reviewer's specific suggestion (return
`targetEvent.slug` instead of `redirect.newSlug`) is observationally
identical post-equality-check — both values are equal at the
assertion point.

### 2. `Set-Cookie` + cacheable redirect on shared caches (out-of-scope)

The reviewer flagged that the global auth `onRequest` hook can call
`reply.clearCookie(SESSION_COOKIE_NAME)` on anonymous `/by-slug/:slug`
requests when a stale session cookie reaches the API but Redis has no
matching session (`apps/api/src/plugins/auth.ts:34-38`). The resulting
`Set-Cookie` response paired with `Cache-Control: public, max-age=300`
is technically unsafe for shared caches that don't strip Set-Cookie:
the cleared-cookie response could be replayed to other users behind
the same intermediary, logging them out spuriously.

**Decision:** Out-of-scope for I-2.4.6. This is a system-wide concern
that pre-dates this slice and applies equally to the I-2.4.5 SSR 200
cache contract (`Cache-Control: public, s-maxage=60,
stale-while-revalidate=300` on the same routes). Fixing it
correctly belongs in a dedicated infra slice — either (a) skip
stale-cookie clearing on routes flagged as anonymous + cacheable,
(b) downgrade Cache-Control to `private` whenever the response
carries `Set-Cookie`, or (c) install an `onSend` hook that strips
`Set-Cookie` from responses with `public` Cache-Control. Patching
only the redirect path here would create an inconsistent contract
between the 200 and 301 cache directives on the same endpoint.

**Practical risk:** Low. (i) Cloudflare (the assumed CDN per
`tanstack-start.instructions.md`) by default treats `Set-Cookie` as
cache-bust regardless of `public`. (ii) The hazard requires (a) a
user with a stale session cookie, (b) Redis evicting their session,
(c) a navigation to a renamed slug, and (d) a shared-cache
intermediary that ignores Cloudflare's Set-Cookie convention. Worst
case is a spurious logout, not data exposure.

### Confirmed-correct (no action needed)

- **TanStack `redirect({ headers })` is real.** Verified against
  `@tanstack/router-core@1.168.15/dist/esm/redirect.js` — the
  `headers` option is forwarded into the constructed `Response`
  (line 25–30), so the `Cache-Control` directive is on the wire,
  not just stashed in `options`.
- **Loop guard and chain-rename guard are both necessary.** The loop
  guard short-circuits on data corruption (`oldSlug === newSlug` in
  the same row — should never exist, but defensive); the chain-rename
  guard catches the live-update case where the canonical slug has
  moved on. They cover disjoint conditions.
- **301 vs 308.** The public detail routes are GET-only — `Link`,
  `<a>`, fetch GET. 301 (which historically allowed POST → GET
  rewriting) is the conventional choice and matches how Google
  indexes slug renames.
- **No open-redirect risk on `newSlug`.** `newSlug` is sourced
  exclusively from the `slug_redirects` table, which is populated only
  by authenticated organizer/admin slug-rename flows that validate
  against `eventSlugSchema` / `organizerSlugSchema`. The web loader
  uses it as a typed `params.slug` against a static `to:` route — no
  protocol-relative or absolute-URL injection is possible.
