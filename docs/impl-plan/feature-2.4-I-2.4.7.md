# I-2.4.7 — Canonical URL + alternate language tags

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` — Feature 2.4 row I-2.4.7
**Scope:** Audit existing `<link rel="canonical">` emission on the public event detail and organizer profile routes, then add a hreflang scaffold so V1 ships with `hreflang="en"` + `hreflang="x-default"` and is ready to swap to per-locale URLs when V2 introduces Hindi/Tamil. Frontend-only — no API changes.

---

## Goal

Search engines need an explicit canonical URL so that slug-rename redirects, query-string variants, and mixed-case paths all collapse to a single indexable URL. Adding hreflang now (even with one locale) means the V2 i18n rollout is a `links` array swap, not a structural change to every route's `head()` payload.

---

## Source of truth

- `docs/requirements.md` — F-2.4.7 (canonical + hreflang scaffold for V2 i18n).
- `docs/v1-implementation-plan.md` — I-2.4.7 row.
- Deps:
  - I-2.1.5 (`apps/web/src/features/event-detail/seo.ts` — canonical already lands here).
  - I-2.3.1 (`apps/web/src/features/organizer-detail/seo.ts` — canonical already lands here).
  - I-2.4.6 (`VITE_SITE_URL` env validation in `apps/web/src/lib/env/public.ts`).

---

## Audit findings — existing canonical emission

| Concern (from issue spec) | Status | Evidence |
| --- | --- | --- |
| Built from `VITE_SITE_URL` (no double-slash bugs) | ✅ Pass | Both helpers route through `new URL("/events/${slug}", origin).href` / `new URL("/organizers/${slug}", origin).href`. The WHATWG parser collapses any number of trailing slashes and strips path / query / fragment from `siteUrl`. Verified by the `strips trailing slashes / accidental path / query / fragment` cases in `seo.test.ts` (extended in this issue to also assert hreflang hrefs match canonical exactly). |
| HTTPS-only (or fail-soft when env unset — must NOT emit `http://` accidentally) | ⚠️ Honoured by deferral, not enforcement | The env layer (`apps/web/src/lib/env/public.ts:42-56`) accepts both `http:` and `https:` (so we can point staging at an http URL without forking the helper). The helper itself does NOT downgrade or rewrite the scheme. **Production safety is delivered by config**: production env points at `https://eventkart.in`, so no `http://` URL is ever emitted in prod. The **fail-soft when env unset** half of the contract is fully covered — if `VITE_SITE_URL` is unset, both `og:url` and `<link rel="canonical">` (and now hreflang) are omitted entirely. New test: `honours the configured scheme on siteUrl (http for staging) — does not silently rewrite`. |
| Slug used is the CURRENT slug from the loader response (not a legacy slug) | ✅ Pass | Both routes pass `loaderData.slug` / `data.profile.slug` straight through. The loaders apply slug-rename redirects upstream (`I-2.1.10` for event, `organizer-detail/loader.ts` for organizer), so by the time the helper runs the slug is the canonical one. New regression test pinned this for both helpers (`uses the CURRENT slug from a slug-rename payload`). |
| Fail-soft when `VITE_SITE_URL` unset → omit canonical entirely | ✅ Pass | `buildCanonicalUrl(undefined, …)` and `buildOrganizerCanonicalUrl(undefined, …)` return `undefined`; both `links` arrays become `[]` and no `og:url` meta is pushed. Existing tests already cover this; new test additionally asserts hreflang is omitted in this case. |

**Net of audit:** no regressions, no rewrites required. The helpers as shipped in I-2.1.5 / I-2.3.1 already satisfy the canonical contract; this issue only adds hreflang and tightens test coverage.

---

## Hreflang design

### V1 (this issue) — English-only

Both helpers emit, in addition to the existing canonical link:

```html
<link rel="alternate" hreflang="en"        href="${canonicalUrl}">
<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
```

**Why both:** `hreflang="en"` declares the language; `hreflang="x-default"` is the fallback Google recommends for "no better match" (pre-translation, region-agnostic visitors). Per Google's spec, the set must be self-referential — the canonical English page must list itself as the English alternate. We satisfy that by pointing both at the canonical URL.

**Gating:** hreflang is gated on the same `canonicalUrl` that gates `<link rel="canonical">`. If `VITE_SITE_URL` is unset or malformed, `canonicalUrl` is `undefined` and **no** `links` are emitted (canonical, hreflang en, hreflang x-default — all three omitted together). This is mandatory because Google's spec requires hreflang URLs to be **absolute**; emitting a relative or origin-less URL would be invalid.

### Type / shape

`HeadLinkEntry` gains an optional `hreflang?: string` field. The canonical link does NOT carry `hreflang` (per spec — canonical describes the URL itself; hreflang describes the alternates). Each `<link rel="alternate">` entry sets `hreflang` and `href`.

The TanStack Start router (`@tanstack/react-router` v1.168) renders link entries by spreading `attrs` into a JSX `<link>` element (`Asset.js:19`). React 19 passes through unknown HTML attributes verbatim, so lowercase `hreflang` (HTML standard) reaches the DOM as `hreflang="en"` without any prop-name translation. Confirmed via `node_modules/.pnpm/@tanstack+react-router@1.168.15/.../dist/esm/Asset.js`.

### Order

`canonical` first, then `alternate` entries in the order `en` → `x-default`. The order is not semantically meaningful (search crawlers parse the set, not the position), but the test pins it so accidental reordering surfaces in review.

---

## V2 i18n migration plan

When Hindi (`hi-IN`) and Tamil (`ta-IN`) ship (post-V1), the same-href hreflang scaffold becomes per-locale absolute URLs:

```html
<link rel="canonical"                            href="https://eventkart.in/en/events/${slug}">
<link rel="alternate" hreflang="en"              href="https://eventkart.in/en/events/${slug}">
<link rel="alternate" hreflang="hi-IN"           href="https://eventkart.in/hi/events/${slug}">
<link rel="alternate" hreflang="ta-IN"           href="https://eventkart.in/ta/events/${slug}">
<link rel="alternate" hreflang="x-default"       href="https://eventkart.in/en/events/${slug}">
```

### Routing strategy decision (deferred to V2)

| Strategy | Pros | Cons | EventKart fit |
| --- | --- | --- | --- |
| **Path-prefix routing** (`/en/events/...`, `/hi/events/...`) | CDN-friendly (one cache key per locale, no `Vary` header). Each URL is independently shareable, indexable, and deep-linkable. Hreflang URLs are trivially absolute. Works with our existing Cloudflare `s-maxage=60, stale-while-revalidate=300` strategy with **zero** Cache-Control changes. | Requires a route-tree refactor: every `_public` route gets a `$locale` param. Slug-rename redirects must preserve the locale segment. | ✅ **Recommended.** The Cloudflare cache is the dealbreaker — we already rely on edge caching for `/events/:slug` (see `apps/web/src/features/event-detail/cache-headers.ts`), and `Vary: Accept-Language` would explode the cache cardinality (every distinct `Accept-Language` header becomes a separate cache entry). |
| **`Vary: Accept-Language`** (single URL `/events/${slug}` content-negotiates) | URLs stay short. No route refactor. | Devastating for CDN: Cloudflare keys cache entries by the entire `Vary` header set, and `Accept-Language` is high-cardinality (`en-US`, `en-GB`, `en;q=0.9,hi;q=0.8`, …). Hit ratio collapses. Hreflang becomes structurally incompatible — alternate URLs must differ. | ❌ **Reject.** Already incompatible with our CDN strategy; would force us to choose between i18n and edge caching. |
| **Cookie / subdomain switching** (`hi.eventkart.in`) | CDN-clean (subdomain is a separate cache namespace). | Subdomain ops cost (separate TLS cert SAN, separate analytics property, separate sitemap). Adds a hop for users switching locale. | ⚠️ Possible but heavier than path-prefix. Reconsider only if SEO data later shows search intent diverges sharply by region. |

**V2 implementation footprint when triggered:**

1. Lift route-level `$locale` param into `_public/$locale/events/$slug/index.tsx` (or `_public/$locale/_layout`).
2. Update `buildCanonicalUrl` / `buildOrganizerCanonicalUrl` signatures to accept a `locale: "en" | "hi" | "ta"` argument and build `${origin}/${locale}/events/${slug}`.
3. Update the `links` array constructor in both `seo.ts` helpers to emit one `<link rel="alternate">` per supported locale (driven by a `SUPPORTED_LOCALES` constant in `packages/shared` so API and web stay in sync).
4. Add a middleware that 301-redirects unprefixed legacy URLs (`/events/:slug` → `/en/events/:slug`) so existing inbound links and search index entries do not 404.
5. Reissue sitemap (I-2.4.5) with one entry per `(slug, locale)` tuple.

The V1 `HeadLinkEntry` shape with optional `hreflang` is V2-ready; no shape change needed.

---

## Listing pages

| Route | Status | Action |
| --- | --- | --- |
| `/_public/` (events discovery — `apps/web/src/routes/_public/index.tsx`) | No `head()` block; no SEO helper exists in `apps/web/src/features/events-discovery/`. | **Deferred** to whichever issue first ships discovery-page SEO meta. When that issue lands, it must build canonical + hreflang from the **paginated, sort-normalized** URL (see I-2.4.4 sitemap rules) — not the raw request URL — to avoid duplicate-content signals from `?page=1&sort=…` permutations. |
| `/organizers` (organizer listing) | Does not exist as an SSR route in V1 — no global organizer index ships before V2 (per product plan §6 Layer 4). | **Deferred** — track when the route lands. |

Documenting both as deferred is the conservative call: extending a non-existent helper would mean inventing a brand-new SEO surface in this PR, which is out of I-2.4.7's scope ("audit existing canonical emission"). When the discovery-page SEO surface ships, it should reuse the same `HeadLinkEntry` shape and the same canonical/hreflang gating logic established here.

---

## Decisions

1. **Same-href hreflang in V1 (en + x-default → canonical).** Self-referential per Google's spec; ready to swap to per-locale URLs in V2 with no shape change.
2. **Lowercase `hreflang` attribute.** Matches HTML standard. React 19 passes it through unchanged. Confirmed via `Asset.js` in TanStack Start.
3. **No HTTPS-only enforcement at the helper layer.** Env layer accepts http(s); production config points at https. Pinning HTTPS in the helper would block staging flexibility without adding production safety.
4. **Hreflang gates on canonicalUrl, not on siteUrl.** A malformed `siteUrl` produces no canonical AND no hreflang — the failure is uniform. Tested explicitly.
5. **Listing-page SEO is deferred, not stubbed.** Adding SEO to `/_public/` here would expand scope; flagging it in this doc is the contract for the next issue.

---

## Test coverage added (this issue)

`apps/web/src/features/event-detail/seo.test.ts` (+5 tests, +1 expanded):
- Hreflang en + x-default emitted with siteUrl set, both = canonical href.
- Hreflang omitted when siteUrl unset / malformed.
- Trailing-slash idempotence asserted on hreflang hrefs (not just canonical).
- Slug-rename: helper uses CURRENT slug from payload (covers the audit concern).
- Scheme is honoured, not rewritten (http stays http).

`apps/web/src/features/organizer-detail/seo.test.ts` (+5 tests, +1 expanded): same set, organizer-shaped.

All 59 tests in the two `seo.test.ts` files pass; full `apps/web` suite (552 tests) green; `pnpm --filter web check-types` clean.

---

## Files touched

| File | Change |
| --- | --- |
| `apps/web/src/features/event-detail/seo.ts` | `HeadLinkEntry` gains optional `hreflang`. `buildPublicEventMeta` appends two `<link rel="alternate">` entries (en + x-default → canonical) when canonical is emitted. JSDoc updated. |
| `apps/web/src/features/organizer-detail/seo.ts` | Same change, organizer-shaped. |
| `apps/web/src/features/event-detail/seo.test.ts` | Updated `links` equality assertion to include the two alternate entries; +5 new test cases. |
| `apps/web/src/features/organizer-detail/seo.test.ts` | Same. |
| `docs/impl-plan/feature-2.4-I-2.4.7.md` | This document. |

---

## Rollback

```sh
git revert <commit-sha>
```

Hreflang is purely additive: removing the alternate entries leaves the canonical behaviour exactly as it was after I-2.1.5 / I-2.3.1. Search crawlers tolerate disappearing hreflang gracefully (they fall back to language guessing).
