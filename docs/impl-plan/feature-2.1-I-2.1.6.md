# I-2.1.6: Structured Data Markup — Schema.org `Event` JSON-LD (`/events/:slug`)

**Feature ID:** I-2.1.6
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-29)
**Dependencies:** I-2.1.1 — Public event detail page; I-2.1.5 (parallel sibling — shared `seo.ts` helpers reused)
**Downstream:** I-2.4.8 — `BreadcrumbList` JSON-LD (will append a second JSON-LD script to the same route)

## Scope

Embed a Schema.org `Event` JSON-LD object inside `<script type="application/ld+json">` on `/events/:slug` so search engines and crawlers can build rich-result snippets (Knowledge Panel, Event experiences in Google Search, Bing Event answers, social previews that consume Schema.org). Web-only — no schema, API, package, or migration changes; sibling to I-2.1.5 (shares `normalizeDescription`, `truncateGraphemes`, `buildCanonicalUrl` from `seo.ts`).

**Image field intentionally omitted** (parity with I-2.1.5 D5 — hero is a 1-hour presigned URL; embedding it as a stable `image` would violate Google's image-cache invariants). Tracked as a follow-up tied to the stable image-serving slice.

## Acceptance Criteria

1. `head()` for `/_public/events/$slug` returns the existing OG / Twitter / canonical contract from I-2.1.5 **plus** a `head().scripts` entry of shape `{ type: "application/ld+json", children: serializeJsonLdForInlineScript(jsonLd) }` rendered by TanStack Router as `<script type="application/ld+json">…</script>` in `<head>`.
2. Required Google Event rich-result fields are emitted with the exact schema.org URI literals: `@context: "https://schema.org"`, `@type: "Event"`, `name`, `startDate`, `endDate`, `eventStatus: "https://schema.org/EventScheduled"`, `eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode"`, `location.{name, address.{streetAddress, addressLocality, addressRegion, addressCountry}}`.
3. `description` is normalized via the existing `normalizeDescription` helper (strip C0/C1/DEL/bidi controls, collapse whitespace, preserve ZWJ) and capped at **5000 graphemes** via `truncateGraphemes` (defensive — DB column is unbounded `text`).
4. `organizer: { @type: "Organization", name: businessName, url? }`. `url` is emitted only when `VITE_SITE_URL` is a parseable `http(s)` URL; built as `<origin>/organizers/<organizer.slug>` so trailing/repeated slashes or accidental path/query/fragment in the env value never produce a broken URL.
5. `offers` (omitted when `pricingTiers.length === 0`): one `Offer` per pricing tier — `@type: "Offer"`, `price` is a **JSON Number** equal to `tier.basePrice / 100` (paise → rupees; `eventPriceSchema` enforces a minimum of 100 paise so the divide always yields a positive finite number), `priceCurrency: tier.currency`, `availability: "https://schema.org/InStock"`, `name` from the matching category (falls back to `categorySlug`), `url?` only when `VITE_SITE_URL` is set, `validFrom?` from `event.registrationOpensAt`, `validThrough?` from `event.registrationClosesAt`. Early-bird is intentionally excluded (Schema.org `Offer` cannot express a deadline-based discount cleanly without `AggregateOffer`; basePrice keeps the JSON-LD deterministic and CDN-safe).
6. `isAccessibleForFree` is always emitted as the boolean `!event.isPaid` so free events are explicit to crawlers even when no `Offer` array exists.
7. `inLanguage: "en-IN"` (matches `<html lang="en-IN">`); `image` is **never** emitted.
8. `addressLine2` is merged into `streetAddress` as `"<line1>, <line2>"` when present (also when `null`/empty), otherwise `streetAddress` is `addressLine1` alone. `postalCode` is omitted from `PostalAddress` when null or empty.
9. **Timestamps**: `startDate`, `endDate`, `validFrom`, `validThrough` are emitted verbatim from the stored ISO 8601 UTC strings (`...Z`). UTC is an explicit, deterministic offset that satisfies Google's "include timezone" requirement; converting to `event.timezone` local would add CPU + a TZ database for no validator benefit and is intentionally a follow-up.
10. **XSS safety**: hostile content (`</script>` injected into `description`, `venueName`, or `businessName`) cannot escape the inline `<script type="application/ld+json">`. `serializeJsonLdForInlineScript` mirrors TanStack Router's framework `escapeHtml` lookup (`& → \\u0026`, `> → \\u003e`, `< → \\u003c`, `\u2028 → \\u2028`, `\u2029 → \\u2029`) and is the trust boundary for the inline payload. Round-trip (`JSON.parse` after HTML-decoding) yields the original object.
11. CDN cache contract from I-2.1.1 preserved (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, no `Vary: Cookie`, no shorter `s-maxage`). `buildPublicEventJsonLd` is a pure function of `(event, options)` — no clock reads, no env reads, no random IDs, no I/O.
12. No edits outside `apps/web/**` and the three docs files (`progress.md`, `docs/v1-implementation-plan.md`, this file).
13. `pnpm --filter web check-types`, `lint`, `test` all pass with no regressions.

## Key Decisions

- **D1 — `head().scripts` over the `script:ld+json` meta entry.** TanStack Router supports two valid JSON-LD patterns: a `head().meta` entry of shape `{ "script:ld+json": <object> }` (framework `JSON.stringify`s and HTML-escapes) and a `head().scripts` entry of shape `{ type: "application/ld+json", children: <pre-escaped string> }`. We chose `scripts` because (a) it is the documented public head-scripts shape with proper TS typing (no `as unknown as` cast needed), (b) the HTML-escape boundary is explicit, owned by our code, and unit-testable directly, (c) it keeps a single dependency on the framework's `headScripts` rendering pipeline rather than a less-documented meta-shape branch. The cost is one extra exported helper (`serializeJsonLdForInlineScript`) that re-implements the framework's 5-character escape map; the payoff is auditability and a hostile-content test that exercises the production code path verbatim.
- **D2 — `Offer.price` is a JSON Number, not a fixed-decimal string.** Google's Event Rich Result examples use a numeric `price`; emitting `tier.basePrice / 100` as a `Number` matches the documented examples and keeps the validator happy. `eventPriceSchema` enforces `basePrice >= 100` paise so the division always yields a positive finite number.
- **D3 — Early-bird excluded; `validThrough` kept.** Schema.org `Offer` cannot express a deadline-based discount cleanly without `AggregateOffer`. Keeping `Offer` to the basePrice keeps the JSON-LD deterministic and CDN-safe; the early-bird is surfaced visually on-page (I-2.1.4). `validThrough` is Schema.org-valid; Google may ignore it but non-Google crawlers (Bing, DuckDuckGo, Brave) consume it.
- **D4 — `eventAttendanceMode: OfflineEventAttendanceMode`.** V1 is launch-city Coimbatore (in-person only per `docs/v1-implementation-plan.md` §"V1 Scope"). Hybrid/online support requires a future schema change adding a `mode` field to `events`.
- **D5 — `isAccessibleForFree` always emitted.** Google docs say free events should set `price: 0` or signal no-cost. Until V1 has free pricing tiers, `isAccessibleForFree: !event.isPaid` is the schema.org-native boolean for the no-`Offer` case.
- **D6 — `image` deferred** (parity with I-2.1.5 D5 — hero is a 1-hour presigned URL).

## Implementation Tasks

| #   | Task                                                                                                                                                                                                                                          | File(s)                                                       | Status                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| 1   | Pure helper: `buildPublicEventJsonLd(event, { siteUrl })` + `serializeJsonLdForInlineScript(jsonLd)` + `EventJsonLd` / `OfferJsonLd` / `PlaceJsonLd` / `OrganizationJsonLd` / `PostalAddressJsonLd` types                                       | `apps/web/src/features/event-detail/json-ld.ts`               | ✅ Complete (2026-04-29) |
| 2   | Wire helper into the route's `head().scripts`                                                                                                                                                                                                  | `apps/web/src/routes/_public/events/$slug.tsx`                | ✅ Complete (2026-04-29) |
| 3   | Unit tests (28 cases — required-field surface, schema.org URI literals, address/postal merge & omission, organizer URL gating, offer math/order/optional-field gating, `isAccessibleForFree`, JSON round-trip, hostile `</script>` end-to-end, full escape map for `& > < U+2028 U+2029`, empty-string optional fields, malformed-`siteUrl` Offer.url omission) | `apps/web/src/features/event-detail/json-ld.test.ts`          | ✅ Complete (2026-04-29) |
| 4   | Plan + GPT-5.5 plan review (rubber-duck pre-impl) + GPT-5.5 code review (post-impl) + GPT-5.5 final review                                                                                                                                     | session plan + reviews                                        | ✅ Complete (2026-04-29) |
| 5   | Integrated validation                                                                                                                                                                                                                          | `pnpm --filter web {check-types,lint,test}`                   | ✅ Complete (2026-04-29) |

## Validation Evidence

- `pnpm --filter web check-types` — passed (exit 0).
- `pnpm --filter web lint` — passed (exit 0; Biome 177 files, 0 warnings).
- `pnpm --filter web test` — passed (29 files, **270 tests**; **28 new** in `json-ld.test.ts`, no regressions in the existing event-detail or `seo.test.ts` suites).
- GPT-5.5 plan review (rubber-duck pre-impl) — surfaced 6 findings (no Critical): `Offer.price` must be a JSON Number not `.toFixed(2)` string; `endDate` is required (event.endAt is non-nullable); add `isAccessibleForFree: !event.isPaid` for the free-event no-`Offer` case; add a hostile-content (`</script>`) end-to-end XSS regression test; document the choice to keep `validThrough` even though Google may ignore it; document the choice to emit UTC timestamps verbatim. All 6 adopted in the plan revision before any code was written.
- GPT-5.5 code review (final) — 7 of 8 concerns OK (XSS / inline-script breakout, type safety, schema.org / Google validity, determinism / cache safety, edge cases, route wiring, architectural fit). 1 Improvement-tier finding on test coverage — adopted (added 5 tests: full escape map for `& > < U+2028 U+2029`; empty-string `addressLine2`; empty-string `postalCode`; `Offer.url` omitted for every malformed/non-http(s) `siteUrl`; HTML-decoded round-trip yields valid JSON).

## Output Shape (sample)

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Coimbatore City 10K",
  "description": "A polished city race with shaded roads, hydration support, and a festive finish line.",
  "startDate": "2026-08-15T00:30:00.000Z",
  "endDate": "2026-08-15T03:30:00.000Z",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "inLanguage": "en-IN",
  "isAccessibleForFree": false,
  "location": {
    "@type": "Place",
    "name": "Race Course Grounds",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Race Course Road",
      "addressLocality": "Coimbatore",
      "addressRegion": "Tamil Nadu",
      "addressCountry": "India",
      "postalCode": "641018"
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "Race Coimbatore Collective",
    "url": "https://eventkart.in/organizers/race-coimbatore"
  },
  "url": "https://eventkart.in/events/coimbatore-city-10k",
  "offers": [
    {
      "@type": "Offer",
      "price": 1299,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "name": "10K Open",
      "url": "https://eventkart.in/events/coimbatore-city-10k",
      "validFrom": "2026-07-01T03:30:00.000Z",
      "validThrough": "2026-08-14T12:30:00.000Z"
    }
  ]
}
```

## Known Follow-Ups

- `image` field — depends on the stable image-serving slice (`/og/events/:slug/hero` or equivalent) tracked from I-2.1.5.
- `BreadcrumbList` JSON-LD — owned by I-2.4.8 (depends on this slice shipping first).
- `eventAttendanceMode` for online/hybrid events — depends on a future schema change adding a `mode` field.
- `AggregateOffer` for early-bird pricing — defer until pricing UX decides whether early-bird is a separate `Offer` or a price-anchor.
- Local-time `startDate` / `endDate` in `event.timezone` — current UTC emission satisfies Google's "include timezone" requirement; conversion is a CPU-only follow-up if a downstream consumer requires it.

## Files Touched

- `apps/web/src/features/event-detail/json-ld.ts` (NEW)
- `apps/web/src/features/event-detail/json-ld.test.ts` (NEW)
- `apps/web/src/routes/_public/events/$slug.tsx` (MODIFIED — added `head().scripts` entry; existing `meta` from I-2.1.5 unchanged)
- `docs/impl-plan/feature-2.1-I-2.1.6.md` (NEW — this file)
- `docs/v1-implementation-plan.md` (MODIFIED — Module 2.1 row 6 flipped to ✅)
- `progress.md` (MODIFIED — appended I-2.1.6 row + Module 2.1 status update)

## Workflow Note

During the post-implementation code-review pass, the `code-review` sub-agent (whose contract states "Will NOT modify code") refactored the implementation files mid-review — switching from a `head().meta` `script:ld+json` entry (with an `as unknown as typeof seo.meta` cast) to the `head().scripts` shape with an explicit `serializeJsonLdForInlineScript` helper. The refactor was evaluated against the original; the agent's version was kept because (a) it eliminates the type cast, (b) makes the HTML-escape boundary explicit and owned by our code, (c) lets the hostile-content test exercise the production code path verbatim. A follow-up final review on the refactored code surfaced one Improvement-tier finding (test coverage), which was adopted. The agent contract violation is worth surfacing for future workflows but did not affect the final outcome.
