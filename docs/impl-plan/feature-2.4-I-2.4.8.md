# I-2.4.8: Breadcrumb JSON-LD on event detail (`/events/:slug`)

**Feature ID:** I-2.4.8
**Module:** 2.4 — SEO sweep
**Status:** ✅ Complete (2026-04-29)
**Dependencies:** I-2.4.1 (SEO baseline), **I-2.1.6** (Event JSON-LD — established the
`head().scripts` + `serializeJsonLdForInlineScript` trust boundary that this slice reuses)
**Coordinates with (does not depend on):** I-2.4.7 — Canonical URL tags. I-2.4.7
modifies `seo.ts` helpers; this slice modifies `json-ld.ts` and the route's
`head().scripts` array. The two slices share only the route file and touch
disjoint regions of it (`seo: ...` spread vs the `scripts: [...]` array).

## Scope

Add a Schema.org `BreadcrumbList` JSON-LD payload alongside the existing
`Event` JSON-LD on `/events/:slug` so Google can render the breadcrumb trail
("Home › Events › `{event title}`") in SERP snippets instead of the raw URL.
Pairs with I-2.1.6 — same route, same trust boundary, same fail-soft contract.

**Reference:** [Schema.org BreadcrumbList](https://schema.org/BreadcrumbList) ·
[Google Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)

## Acceptance Criteria

1. New helper `buildPublicEventBreadcrumbJsonLd(event, { siteUrl }): BreadcrumbListJsonLd | null`
   in `apps/web/src/features/event-detail/json-ld.ts`. Returns a Schema.org
   `BreadcrumbList` with three `ListItem` entries:
    - `position 1`: `name: "Home"`, `item: ${origin}/`
    - `position 2`: `name: "Events"`, `item: ${origin}/events`
    - `position 3`: `name: ${event.title}`, `item: ${origin}/events/${event.slug}`
2. **Fail-soft**: returns `null` when `siteUrl` is unset or not a parseable
   `http(s)` URL (mirrors the I-2.4.7 canonical contract and the I-2.1.6
   `Offer.url` / `organizer.url` / top-level `url` gating). Schema.org
   `BreadcrumbList.itemListElement[].item` MUST be an absolute URL — emitting
   relative paths or a non-http(s) origin would trigger validator warnings
   without delivering any rich-snippet benefit.
3. **URL normalization**: each item URL is built via `new URL(path, origin).href`
   so trailing slashes, repeated slashes, or accidental path/query/fragment on
   `VITE_SITE_URL` cannot produce `//events/` or other malformed hrefs. Both
   `https://example.com/` and `https://example.com` produce
   `https://example.com/events/foo` for `slug = "foo"`.
4. **XSS safety**: hostile content (`</script>` injected into `event.title`)
   cannot escape the inline `<script type="application/ld+json">`. The new
   helper reuses `serializeJsonLdForInlineScript` (the same trust boundary
   as I-2.1.6) — that function mirrors TanStack Router's framework `escapeHtml`
   lookup (`& → \u0026`, `> → \u003e`, `< → \u003c`, `\u2028 → \u2028`,
   `\u2029 → \u2029`). Round-trip (`JSON.parse` after HTML-decoding) yields
   the original payload.
5. **Route wiring**: `/_public/events/$slug/index.tsx` `head().scripts` pushes
   a SECOND `application/ld+json` entry AFTER the existing Event JSON-LD entry.
   When the helper returns `null`, the second entry is skipped — the Event
   JSON-LD entry is unaffected.
6. **CDN cache contract** from I-2.1.1 preserved (`Cache-Control: public,
   s-maxage=60, stale-while-revalidate=300`, no `Vary: Cookie`).
   `buildPublicEventBreadcrumbJsonLd` is a pure function of `(event, options)`
   — no clock reads, no env reads, no random IDs, no I/O.
7. **Generic serializer**: `serializeJsonLdForInlineScript` becomes
   `<T>(jsonLd: T): string` so it can serialize both `EventJsonLd` and
   `BreadcrumbListJsonLd` without per-shape duplication. The runtime
   behavior is unchanged (the existing 28 tests still pass).
8. No edits outside `apps/web/**` and this plan file. `progress.md` is
   intentionally untouched.
9. `pnpm --filter web check-types` and `pnpm --filter web test` pass with
   no regressions.

## Key Decisions

- **D1 — Extend `json-ld.ts`, do not add a sibling file.** The helper is
  ~30 lines plus one types block, and it shares the `serializeJsonLdForInlineScript`
  trust boundary and the private `resolveSiteOrigin` validator with the
  Event helper. Splitting into `breadcrumb-json-ld.ts` would either duplicate
  `resolveSiteOrigin` (drift risk) or require exposing it as a public export
  (broader API surface for no benefit). The single-file split keeps the
  trust boundary local and auditable.
- **D2 — Generic serializer over a per-shape overload.** Making
  `serializeJsonLdForInlineScript<T>(jsonLd: T): string` generic costs zero
  runtime change and removes a class of future drift (every new JSON-LD shape
  no longer needs to extend a shared union type). The function's contract is
  about HTML escaping the `JSON.stringify` output, not about the input shape.
- **D3 — Fail-soft to `null` when `siteUrl` is unset, not relative URLs.**
  Schema.org `BreadcrumbList.item` requires an absolute URL. Emitting
  `"/events/foo"` would produce a validator warning and a worse snippet than
  emitting nothing. The `null` return mirrors the canonical-link / OG
  contract from I-2.4.7 and I-2.1.5.
- **D4 — Push a second `<script type="application/ld+json">` instead of
  collapsing into a `@graph`.** Schema.org allows multiple JSON-LD scripts
  in one document and Google explicitly recommends one script per type for
  readability. A `@graph` would couple the Event and BreadcrumbList lifecycles
  unnecessarily — the BreadcrumbList must skip when `siteUrl` is unset, but
  the Event JSON-LD must always emit. Two scripts decouple the two contracts.
- **D5 — `event.title` is verbatim, not `normalizeDescription`'d.** The
  Event helper normalizes `description` because that field is multi-line
  prose with potential bidi-control spoofing risk. `event.title` is a
  single-line headline already validated by `eventPublicDetailSchema` and
  rendered verbatim in `<title>`, OG `og:title`, and Twitter `twitter:title`.
  Re-normalizing it here would introduce inconsistency between the breadcrumb
  text and the page title.
- **D6 — `position` is a JSON Number (1, 2, 3), not a string.** Schema.org
  `ListItem.position` is `Integer`. Google's examples and validators accept
  only numeric `position` for breadcrumb rich results.

## Threat Model — Inline-Script Injection

**Attack surface.** `event.title` is operator-controlled (organizer-supplied
when creating an event). It is rendered:
1. In the page `<h1>` via React (auto-escaped — safe).
2. In `<title>`, `<meta og:title>`, `<meta twitter:title>` via TanStack
   Router head meta entries (framework-escaped — safe).
3. **NEW**: inside `<script type="application/ld+json">…</script>` as part
   of the breadcrumb payload. **TanStack Start `head().scripts` does NOT
   auto-escape `children`** — the framework writes the string verbatim.

**Threat.** A malicious organizer creates an event titled
`Race </script><script>alert(1)</script>`. Without escaping, the
browser parses the literal `</script>` inside the breadcrumb script as
the close tag, exits raw-text mode, parses the next `<script>alert(1)</script>`
as executable JS, and runs attacker code in the eventkart.in origin.

**Mitigation.** All JSON-LD payloads pass through
`serializeJsonLdForInlineScript` before being assigned to `children`. That
helper:
1. `JSON.stringify`s the payload (`<` → literal `<` inside JSON string).
2. Replaces every occurrence of `&`, `<`, `>`, `\u2028`, `\u2029` with
   the JS string-escape form `\u0026`, `\u003c`, `\u003e`, `\u2028`, `\u2029`.
   Inside a JSON string literal these are the same character-for-character
   replacement as TanStack Router's framework `escapeHtml` lookup, so the
   browser's HTML tokenizer cannot match `</script` as a close tag and
   `JSON.parse` losslessly recovers the original payload.

**Why `<` matters.** HTML5 raw-text-mode `<script>` elements only terminate
on `</script` (case-insensitive), so escaping `<` is sufficient. Escaping
`>` and `&` is defense-in-depth that matches the framework lookup.

**Why `U+2028` / `U+2029` matter.** Pre-2018 Safari treated these as line
terminators inside JS string literals and would terminate the JSON literal
early. JSON.stringify already encodes them, but the explicit replacement
keeps the trust boundary auditable.

**Test coverage** (in `json-ld.test.ts`):
- "neutralizes hostile titles containing `</script>`" — end-to-end
  hostile-payload test that mirrors the production code path verbatim.
- "survives U+2028 / U+2029 in the title" — codepoint regression guard.
- "preserves Devanagari, emoji, and ZWJ sequences in the title" —
  proves the escape map is lossless for non-ASCII content.
- "Round-trip" — proves `JSON.parse` after HTML-decoding yields the
  original object (the escape is reversible by browsers, not lossy).

## Fail-Soft Contract (parity with I-2.4.7)

| Condition                                  | Helper return | Route behavior                                          |
| ------------------------------------------ | ------------- | ------------------------------------------------------- |
| `VITE_SITE_URL` unset                      | `null`        | Skip the second `<script type="application/ld+json">`   |
| `VITE_SITE_URL = ""`                       | `null`        | Skip                                                    |
| `VITE_SITE_URL = "not a url"`              | `null`        | Skip                                                    |
| `VITE_SITE_URL = "ftp://x"`                | `null`        | Skip (non-http(s) scheme rejected)                      |
| `VITE_SITE_URL = "data:text/plain,hi"`     | `null`        | Skip                                                    |
| `VITE_SITE_URL = "https://example.com"`    | object        | Emit BreadcrumbList with absolute https URLs            |
| `VITE_SITE_URL = "https://example.com/"`   | object        | Same — trailing slash normalized                        |
| `VITE_SITE_URL = "https://example.com/x"`  | object        | Same — path stripped, only origin honored               |

In every case the existing Event JSON-LD (I-2.1.6) is emitted unchanged.

## Implementation Tasks

| #   | Task                                                                                                                                                                                                                                                              | File(s)                                                       | Status                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| 1   | Add `BreadcrumbItemJsonLd` / `BreadcrumbListJsonLd` types and `buildPublicEventBreadcrumbJsonLd(event, { siteUrl })` helper. Reuse private `resolveSiteOrigin`. Make `serializeJsonLdForInlineScript` generic over `T` so the same trust boundary handles both shapes. | `apps/web/src/features/event-detail/json-ld.ts`               | ✅ Complete (2026-04-29) |
| 2   | Wire helper into the route — push a SECOND `application/ld+json` entry into `head().scripts` AFTER the existing Event JSON-LD entry. Skip when helper returns `null`. Existing Event JSON-LD entry untouched.                                                       | `apps/web/src/routes/_public/events/$slug/index.tsx`          | ✅ Complete (2026-04-29) |
| 3   | Unit tests (10 cases): null on unset/invalid siteUrl, three ListItems with positions 1/2/3 + correct names + absolute URLs, trailing-slash normalization, hostile `</script>` title neutralization end-to-end, U+2028/U+2029 escaping, Devanagari/emoji/ZWJ round-trip preservation, snapshot of full structure, JSON-serializable round-trip. | `apps/web/src/features/event-detail/json-ld.test.ts`          | ✅ Complete (2026-04-29) |
| 4   | Plan + Anvil adversarial review                                                                                                                                                                                                                                  | this file + session ledger                                    | ✅ Complete (2026-04-29) |
| 5   | Integrated validation                                                                                                                                                                                                                                            | `pnpm --filter web {check-types,test}`                        | ✅ Complete (2026-04-29) |

## Validation Evidence

- `pnpm --filter web check-types` — exit 0
- `pnpm --filter web test` — 552/552 pass (was 542 baseline + 10 new
  breadcrumb tests; existing 28 `json-ld` tests remain green after the
  generic-serializer refactor)
- `pnpm --filter web exec vitest run src/features/event-detail/ src/features/organizer-detail/` — 285/285 pass

## Out of Scope (V1 follow-ups)

- **Breadcrumb on `/organizers/:slug`** — separate route, separate helper,
  not part of this slice. A V1.1 follow-up if SERP analytics show benefit.
- **Category-aware breadcrumbs** (e.g. Home › Events › Running › Title) —
  requires a stable category slug taxonomy and a category landing route,
  both V2.
- **Server-rendered `<nav aria-label="Breadcrumb">` UI** — separate slice;
  the JSON-LD payload is for crawlers, not for the visible UI. The visible
  breadcrumb is tracked separately in module 2.1.
