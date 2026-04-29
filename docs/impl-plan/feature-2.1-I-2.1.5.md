# I-2.1.5: Share-Optimized Previews — Open Graph meta tags (`/events/:slug`)

**Feature ID:** I-2.1.5
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-29)
**Dependencies:** I-2.1.1 — Public event detail page
**Downstream:** I-2.1.6 — JSON-LD; I-2.4.7 — Canonical URLs (this feature seeds the event-detail canonical surface)

## Scope

The I-2.1.1 stub `head()` for `/_public/events/$slug` emitted only a
`<title>` and `<meta name="description">`. I-2.1.5 wires a complete set of
Open Graph + Twitter Card text meta tags plus an absolute canonical URL so
LinkedIn, X/Twitter, WhatsApp, Telegram, Slack, Discord, and Facebook
render share previews correctly. **Text-only by design** — `og:image` /
`twitter:image` are deliberately deferred (see Decision D5 below). Web-only:
no schema, API, package, or migration changes.

## Acceptance Criteria

1. `head()` for `/_public/events/$slug` emits, in order:
   - `<title>{event.title} — eventKart</title>`
   - `<meta name="description" content="…">` (≤ 160 graphemes)
   - `<meta property="og:title" content="{event.title}">`
   - `<meta property="og:description" content="…">` (≤ 200 graphemes)
   - `<meta property="og:type" content="website">`
   - `<meta property="og:site_name" content="eventKart">` (or `VITE_APP_TITLE`)
   - `<meta property="og:locale" content="en_IN">`
   - `<meta property="og:url" content="{absoluteUrl}">` **iff** `VITE_SITE_URL` set
   - `<meta name="twitter:card" content="summary">`
   - `<meta name="twitter:title" content="{event.title}">`
   - `<meta name="twitter:description" content="…">`
2. `<link rel="canonical" href="{absoluteUrl}">` emitted **iff** `VITE_SITE_URL` is a parseable `http(s)` URL; built as `new URL(\`/events/${event.slug}\`, new URL(siteUrl).origin).href` so trailing/repeated slashes, accidental path/query/fragment suffixes, or non-web schemes (`ftp:`, `file:`, `data:`, `about:`, `blob:`) are rejected/normalized.
3. Description normalization runs before truncation: C0 controls (except `\t`/`\n`/`\r`), DEL (`U+007F`), C1 controls (`U+0080-U+009F`), and Unicode bidi override / isolate controls (`U+202A-U+202E`, `U+2066-U+2069`) are stripped; ZWJ (`U+200D`) is preserved so emoji clusters survive; runs of any whitespace collapse to a single space; the result is trimmed.
4. Truncation is grapheme-aware via `Intl.Segmenter` (Node 22+, jsdom inherits host Intl). `Array.from` is the documented code-point-safe fallback. `…` is appended only when truncation actually happened.
5. No `og:image` / `twitter:image` (deferred per D5; tracked as known follow-up). The unit suite asserts the absence of both even when `event.heroImage` is populated.
6. CDN cache contract from I-2.1.1 preserved (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, no `Vary: Cookie`, no shorter `s-maxage`).
7. No edits outside `apps/web/**` and the three docs files.
8. `pnpm --filter web check-types`, `lint`, `test` all pass with no regressions.

## Implementation Tasks

| #   | Task                                                                                                                                                  | File(s)                                                                            | Status                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| 1   | Add `VITE_SITE_URL` to public env (optional, validated to be `http(s)`)                                                                                | `apps/web/src/lib/env/public.ts`, `apps/web/.env.example`                          | ✅ Complete (2026-04-29) |
| 2   | Pure SEO helper: `buildPublicEventMeta`, `buildCanonicalUrl`, `normalizeDescription`, `truncateGraphemes`                                              | `apps/web/src/features/event-detail/seo.ts`                                        | ✅ Complete (2026-04-29) |
| 3   | Wire helper into the route's `head()`                                                                                                                  | `apps/web/src/routes/_public/events/$slug.tsx`                                     | ✅ Complete (2026-04-29) |
| 4   | Unit tests (25 cases — meta order, canonical normalization, non-http schemes rejected, og:image absence with/without hero, grapheme/ZWJ truncation, C0/C1/bidi stripping, ZWJ preservation) | `apps/web/src/features/event-detail/seo.test.ts`                                   | ✅ Complete (2026-04-29) |
| 5   | Plan + GPT-5.5 plan review (rubber-duck pre-impl) + GPT-5.5 code review (post-impl) + GPT-5.5 second-pass review of the fix commit                     | session plan + reviews                                                             | ✅ Complete (2026-04-29) |
| 6   | Integrated validation                                                                                                                                  | `pnpm --filter web {check-types,lint,test}`                                        | ✅ Complete (2026-04-29) |

## Validation Evidence

- `pnpm --filter web check-types` — passed (exit 0).
- `pnpm --filter web lint` — passed (exit 0; no warnings).
- `pnpm --filter web test` — passed (28 files, **242 tests**; **25 new** in `seo.test.ts`, no regressions in the existing 17 event-detail tests).
- GPT-5.5 plan review (rubber-duck) — surfaced 4 important / 2 improvement findings: explicit narrowing of og:image scope, URL-origin normalization for canonical, grapheme-aware truncation under Segmenter, description normalization (strip C0, collapse whitespace). All 6 adopted in the plan revision before any code was written.
- GPT-5.5 code review (round 1) — 0 critical, 2 improvements (require `http(s)` scheme on canonical URL; strip DEL/C1/bidi controls in addition to C0). Both adopted.
- GPT-5.5 code review (round 2) — clean (no findings).

## Baseline / Design Notes

- **Why text-only (D5).** `event.heroImage.url` is a 1-hour presigned S3
  URL (`PUBLIC_IMAGE_DOWNLOAD_EXPIRES_IN_SECONDS = 3600` in
  `apps/api/src/modules/events/public-detail-service.ts:30`). Facebook,
  LinkedIn, Slack, and WhatsApp cache OG images for **days to weeks**;
  embedding a 1-hour-lifetime URL would guarantee broken previews after
  cache eviction. The right fix is a stable image-serving slice (e.g., a
  TanStack Start server route at `/og/events/:slug/hero` that 302s to a
  fresh presigned URL on each crawl request) — that is tracked as a
  known follow-up and intentionally out of scope for I-2.1.5.
- **Why `og:type=website`.** OG vocabulary's `event` type is non-standard
  on most platforms; `website` is the lowest-friction, well-supported
  choice. Schema.org `Event` JSON-LD belongs in I-2.1.6.
- **Why Twitter `summary` (not `summary_large_image`).** Without a stable
  image URL the large-image card would render broken. Switch to
  `summary_large_image` when the image-serving slice ships.
- **`og:locale` = `en_IN`.** Matches `<html lang="en-IN">` in
  `apps/web/src/routes/__root.tsx`.
- **`og:site_name`.** Defaults to `"eventKart"` and is overridable via
  `publicEnv.VITE_APP_TITLE` (mirroring the existing root-route fallback
  pattern).
- **Canonical URL hardening.** `buildCanonicalUrl` parses with the WHATWG
  URL parser, requires `http(s)`, and reads `parsed.origin` so trailing
  slashes, repeated slashes, path/query/fragment suffixes, and non-web
  schemes can never produce broken canonicals. The route prefix
  `_public` is a pathless TanStack Router group and is correctly absent
  from the public URL (`/events/<slug>`). The same Zod refinement is
  applied to `VITE_SITE_URL` at env parse time, so misconfiguration
  fails fast at startup.
- **Description normalization.** Source field is `z.string().min(1)` with
  no HTML stripping. Normalization strips C0/C1/DEL controls and bidi
  override/isolate controls (which can spoof the visible direction of a
  share-preview snippet without altering its codepoints), then collapses
  whitespace and trims. ZWJ is preserved so emoji clusters survive.
- **Grapheme-aware truncation.** `Intl.Segmenter` is the primary path so
  ZWJ family sequences (`👨‍👩‍👧‍👦`), regional indicator pairs (`🇮🇳`), and
  combining-mark clusters are kept intact at the truncation boundary.
  `Array.from(str)` is the documented code-point-safe fallback used only
  when `Intl.Segmenter` is missing — it still beats UTF-16-unit slicing
  (which would corrupt surrogate pairs), but is not grapheme-cluster-safe.
- **Description length tiers.** 160 graphemes for `<meta name="description">`
  (SERP truncation) and 200 graphemes for `og:description` /
  `twitter:description` (the platform sweet-spot for unfurls). Both
  routed through the same helper with explicit limits.
- **`VITE_SITE_URL` lives in `publicEnv`.** The canonical origin is
  public (it appears in served HTML), and `head()` can run on both SSR
  and client re-renders, so the value must be available in the browser
  bundle. Documented in `.env.example` alongside `SERVER_URL` (server-only)
  with a note that the two should match in production.
- **CDN cache contract preserved.** No `Vary: Cookie`, no shorter
  `s-maxage`. `head()` output is fully deterministic from event data +
  env, so cached HTML can ship the meta tags safely.
- **Boundary respected.** No edits in `packages/shared/**`,
  `packages/db/**`, `packages/ui/**`, or `apps/api/**`. The work is scoped
  to `apps/web/src/features/event-detail/seo*` + the route file + env +
  `.env.example` + the three progress docs.

## Known Follow-Ups (out of scope for I-2.1.5)

- **Image previews (`og:image` / `twitter:image:large`).** Add a stable
  web route (e.g. `/og/events/:slug/hero`) that 302-redirects to a
  freshly-presigned `event.heroImage.url`. Switch Twitter card to
  `summary_large_image` once the route exists. Track when the
  image-serving slice is scheduled.
- **Canonical URLs for non-event-detail surfaces** — owned by I-2.4.7.
- **JSON-LD Event structured data** — owned by I-2.1.6.
