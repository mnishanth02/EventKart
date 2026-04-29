# I-2.1.4: Category & Pricing Breakdown Display (`/events/:slug`)

**Feature ID:** I-2.1.4
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-29)
**Dependencies:** I-2.1.1 — Public event detail page; I-1.2.3 — Pricing tiers
**Downstream:** I-2.1.7 — Register Now CTA wiring; I-2.1.10 — Early-bird countdown

## Scope

The I-2.1.1 stub rendered categories and pricing as **two side-by-side tables**
(`PublicEventCategoriesTable` + `PublicEventPricingTable`). I-2.1.4 replaces
both with **one combined "Categories & pricing" breakdown card** that joins
each category to its tier on `category.slug ⇄ tier.categorySlug` and exposes
distance, base price, and (when present) the early-bird price + deadline +
status badge. A "From ₹X" indicator is added to the desktop sticky CTA and
the fixed mobile bottom bar so a visitor sees the cheapest currently-effective
price without scrolling. Web-only; no schema, API, or migration changes.

## Acceptance Criteria

1. The page renders **one** combined breakdown table with columns
   Category, Distance, Base price, and (when any tier has a valid early-bird
   offer) Early bird.
2. Each category row shows distance (formatted km), base price (₹), and
   either an early-bird price + deadline + `Active`/`Expired` badge, or the
   em dash `—` when that tier has no valid early-bird offer.
3. The deadline string is formatted in `event.timezone` (`Asia/Kolkata` for
   the MVP) via `Intl.DateTimeFormat`; falls back to the runtime locale on
   any `RangeError`.
4. The Register CTA shows `From ₹<min>` (with `(early-bird)` suffix when the
   minimum comes from an active early-bird tier) on **both** the desktop
   sticky aside and the fixed mobile bottom bar.
5. Categories sort by `sortOrder` ascending (preserving the I-2.1.1 contract).
6. Mobile (< sm) renders a list of cards with proper `<dl>`/`<dt>`/`<dd>`
   semantics — Distance, Base price, and (when relevant) Early bird are each
   labelled rather than bare `<dd>` values.
7. The schema/API contract is unchanged; only `apps/web/**` (+ docs) are
   modified. The CDN cache contract from I-2.1.1
   (`s-maxage=60, stale-while-revalidate=300`, no `Vary: Cookie`) is preserved.
8. No SSR / first-hydration mismatch: the **volatile** signals (`Active`/
   `Expired` badge, `From ₹X` CTA price) are gated by a client-only
   `useNow()` hook so the cached HTML never advertises an out-of-date status.
9. The legacy guard `earlyBirdPrice >= basePrice` is centralized in a single
   helper that **both** the breakdown UI and the "From" CTA route through —
   the two surfaces can never disagree about whether a tier has a valid offer.

## Implementation Tasks

| #   | Task                                                                                      | File(s)                                                                                                | Status                  |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | Pure pricing helpers (`hasValidEarlyBirdOffer` type-predicate, `getEarlyBirdStatus`, `getEffectivePricePaise`, `getStartingPrice`) | `apps/web/src/features/event-detail/pricing.ts`                                                        | ✅ Complete (2026-04-29) |
| 2   | `useNow()` hook (SSR-safe; returns `Date \| null` until the first effect runs)            | `apps/web/src/features/event-detail/hooks.ts`                                                          | ✅ Complete (2026-04-29) |
| 3   | Combined breakdown component with desktop `<table>` + mobile `<ul><li><dl>` semantics     | `apps/web/src/features/event-detail/components/public-event-pricing-breakdown.tsx`                     | ✅ Complete (2026-04-29) |
| 4   | "From ₹X" client-only badge (`data-testid="price-from"`)                                  | `apps/web/src/features/event-detail/components/public-event-price-from.tsx`                            | ✅ Complete (2026-04-29) |
| 5   | Extracted fixed mobile sticky CTA (so the same `PriceFromBadge` can mount in two places)  | `apps/web/src/features/event-detail/components/public-event-sticky-mobile-cta.tsx`                     | ✅ Complete (2026-04-29) |
| 6   | Wire breakdown + CTA badge into the public page; pass `event` to the register CTA         | `apps/web/src/features/event-detail/components/public-event-{page,register-cta}.tsx`                   | ✅ Complete (2026-04-29) |
| 7   | Delete the two old stub tables                                                            | `apps/web/src/features/event-detail/components/public-event-{categories,pricing}-table.tsx` (deleted)  | ✅ Complete (2026-04-29) |
| 8   | Helper unit tests (20 cases — boundary, legacy guard, tie-break, empty)                   | `apps/web/src/features/event-detail/pricing.test.ts`                                                   | ✅ Complete (2026-04-29) |
| 9   | Page tests (combined breakdown, volatile state via `vi.setSystemTime`, true SSR via `react-dom/server` `renderToString`, legacy-guard regression) | `apps/web/src/features/event-detail/components/public-event-page.test.tsx`                             | ✅ Complete (2026-04-29) |
| 10  | Plan + two GPT-5.5 reviews (rubber-duck plan review pre-impl, code review post-impl, second pass on the fix commit)                              | session plan + reviews                                                                                 | ✅ Complete (2026-04-29) |
| 11  | Integrated validation                                                                     | `pnpm --filter web {check-types,lint,test}`                                                            | ✅ Complete (2026-04-29) |

## Validation Evidence

- `pnpm --filter web check-types` — passed (exit 0).
- `pnpm --filter web lint` — passed (exit 0; no warnings).
- `pnpm --filter web test -- run src/features/event-detail` — passed
  (4 files, **41 tests**: 20 in `pricing.test.ts`, 13 in
  `components/public-event-page.test.tsx`, 4 in `loader.test.ts`,
  4 in `api.server.test.ts`).
- GPT-5.5 plan review (rubber-duck) — surfaced 1 critical (CDN/SSR + hydration
  hazard for `Active`/`Expired` badges), revised the plan to a client-only
  `useNow()` strategy before any code was written.
- GPT-5.5 code review (round 1) — 0 critical, 1 important (mobile CTA also
  needs "From ₹X"), 2 minor (legacy guard centralization, mobile `<dl>`
  semantics). The mobile CTA finding was already in the plan; the other
  two were addressed in commit `d4acbb8`.
- GPT-5.5 code review (round 2, on `d4acbb8`) — 0 critical, 0 high, 0 medium,
  3 low (use a TypeScript type-predicate, mirror desktop `—` contract on
  mobile, add an integration regression test for the legacy guard). All three
  low-severity findings adopted in commit `c628ed2`.

## Commits

| SHA       | Message                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `9d5a299` | feat(web): combined category & pricing breakdown for public event page (I-2.1.4)       |
| `25f1484` | test(web): cover combined pricing breakdown and From INRX CTA badge (I-2.1.4)          |
| `142a798` | test(web): add forward-compatible organizer.description=null to fixture (I-2.1.4)      |
| `0f1e249` | test(web): use renderToString for the SSR-safety assertion (I-2.1.4)                   |
| `d4acbb8` | fix(web): apply legacy guard in UI + label mobile breakdown rows (I-2.1.4)             |
| `c628ed2` | refactor(web): tighten guards from 2nd GPT-5.5 review (I-2.1.4)                        |

## Baseline / Design Notes

- **Volatile vs static split.** Categories, distance, base price, early-bird
  price, and the `Until <deadline>` text are **static spec information** and
  ship in the SSR HTML. Only the `Active`/`Expired` badge and the "From ₹X"
  CTA are **volatile** (their truth value depends on `Date.now()`) — these
  render `null` until the first client `useEffect` flips `useNow()` to a
  real `Date`. This keeps SSR + first-hydration outputs identical (no
  React 19 hydration mismatch) and prevents Cloudflare-cached HTML from
  advertising an expired discount as "Active" for up to ~6 minutes.
- **Why we don't gate the early-bird *price* in SSR (rebuttal to round-1
  finding #1).** I-2.1.4's spec explicitly requires "Early-bird pricing
  with deadline display." The deadline text "Until July 15, 2026" is
  past-tense once the cached HTML is stale, making the cached page
  self-truthful — a reader sees the price was offered until that date,
  which is information rather than a misleading current claim. Visitors
  without JavaScript still get full pricing context. The volatile *status*
  badge and *current minimum* CTA are the live signals; gating the
  underlying spec text would weaken the contract without strengthening
  truthfulness.
- **Boundary rule.** Early-bird is `active` when `now < earlyBirdDeadline`
  (right-open interval); `expired` exactly at and after the deadline. Tested
  at the boundary in `pricing.test.ts`.
- **Legacy guard, single source of truth.** `hasValidEarlyBirdOffer(tier)`
  is a TypeScript type-predicate that returns `true` only when **all** of
  `earlyBirdPrice !== null`, `earlyBirdDeadline !== null`,
  `earlyBirdPrice < basePrice`, and the deadline parses to a valid `Date`.
  Both `getEarlyBirdStatus` and `getEffectivePricePaise` route through it,
  the breakdown column toggle uses it, and `EarlyBirdCell` uses it, so the
  badge surface and the CTA can never disagree. Zod blocks `eb >= base`
  for new data; the guard protects pre-Zod / manually-inserted rows.
- **Tie-break.** When two tiers have the same effective price, `getStartingPrice`
  prefers the non-early-bird tier — a more stable label (`From ₹X`)
  rather than `From ₹X (early-bird)` that would flip when the discount expires.
- **`useNow()` does not poll.** It returns once and never updates. The page
  is not a live countdown (countdown is I-2.1.10 turf). A stale badge after
  a tab has been open across the deadline is acceptable — the next CTA
  click takes the user into the booking flow which has its own server-side
  authority.
- **Mobile semantics.** Each category renders as `<li><h3>{name}</h3><dl>`
  with `<dt>Distance/Base price/Early bird</dt><dd>{value}</dd>` triplets.
  Screen readers receive proper label/value pairs rather than a flat
  sequence of values.
- **Cache contract preserved.** No `Vary: Cookie`; no shorter `s-maxage`
  near deadlines. The whole strategy is "client upgrades the cached HTML
  on mount, the CDN never has to know."
- **Tests use `vi.useFakeTimers({ toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"] })`** + `vi.setSystemTime(...)` and `act(() => vi.runAllTimers())` to deterministically flush the `useEffect` that publishes the new `now`. The SSR test uses `react-dom/server`'s `renderToString` directly (Testing Library's `render` flushes effects, which would defeat the test).
- **Branded types.** `EventCategorySlug` is Zod-branded; raw strings in
  fixtures go through `eventPublicPricingTierSchema.parse(...)` so the
  test compiles under `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- **No new currency abstraction.** The whole MVP is INR-only;
  `<CurrencyINR value={paise} />` from the design system is reused.
- **Boundary respected.** No edits in `packages/shared/**`, `packages/db/**`,
  `packages/ui/**`, or `apps/api/**`. The work is scoped to
  `apps/web/src/features/event-detail/**` plus the impl-plan / progress docs.
