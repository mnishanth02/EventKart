# I-2.1.7: "Register Now" CTA on `/events/:slug`

**Feature ID:** I-2.1.7
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-29)
**Dependencies:** I-2.1.1 — Public event detail page; I-2.1.4 — pricing breakdown (`PublicEventPriceFrom` reused)
**Downstream (Phase 3):** Booking flow at `/events/:slug/register` will replace the placeholder route shipped here

## Scope

Replace the previous "Registration coming soon" placeholder on the public event detail page (sidebar Card + mobile fixed bottom bar) with a state-aware CTA whose copy and behaviour reflect the live registration window. Web-only; no schema/API/package changes. Shipping a small Phase-3 placeholder route at `/events/:slug/register` so the CTA has a real link target now and the booking flow can replace it without touching the CTA again.

## Acceptance Criteria

1. CTA renders on both surfaces (`PublicEventRegisterCta` sidebar Card, `PublicEventStickyMobileCta` mobile bottom bar) with identical copy + state. Copy comes from a single `getCtaLabels(state, event)` helper exported from `public-event-register-cta.tsx` so the two surfaces can never disagree.
2. **SSR-safe baseline.** Pre-mount / cached HTML returns `state = "unknown"` and renders the neutral copy `"Ready to race?"` / `"Booking opens with our launch — check back soon."` with an active `<Link>` labelled `"View registration"`. The cached HTML never asserts a live availability state, so the CDN can hold a page across registration-window boundaries without lying about availability. The price hint (`<PublicEventPriceFrom>`) is hidden in the unknown state.
3. **Live state derivation** (after mount, in `useRegistrationState`):
   - `now < parse(registrationOpensAt)` → `not_yet_open` (disabled button; "Registration opens \<date\>"; price hint shown).
   - `now >= parse(registrationClosesAt)` → `closed_window` (disabled button; "Registration closed"; price hint hidden).
   - `now >= parse(endAt)` → `event_ended` (disabled button; "Event has ended"; price hint hidden).
   - otherwise → `open` (active `<Link to="/events/$slug/register" params={{slug}}>`; "Register now"; price hint shown).
   - **Precedence:** `event_ended > closed_window > not_yet_open > open` (computed in `getRegistrationState`, evaluated in that exact order).
4. **Defensive parsing:** invalid `endAt` (NaN) → fail-safe `event_ended`; invalid `registrationClosesAt` → fail-closed `closed_window`; invalid `registrationOpensAt` → ignore (treated as "bound not set"). Both registration timestamps may be `null` (means "no explicit window" — gated only by `endAt`).
5. **Live boundary refresh, no polling.** A single chained `setTimeout` is scheduled at the soonest future boundary among `(opensAt, closesAt, endAt)`; on fire, state is re-derived and the next boundary is scheduled. Delay is `Math.max(1, nextMs - now + 1)` (the `+1ms` ensures the `>=` comparator registers as "passed"), capped at `Math.min(MAX_BOUNDARY_DELAY_MS, …)` where `MAX_BOUNDARY_DELAY_MS = 2_147_483_647` (≈24.8 days) to avoid Node's `TimeoutOverflowWarning` clamp-to-1ms footgun. When no future boundary remains the chain stops; cleanup fires `clearTimeout` on unmount and on dep change.
6. **Disabled CTA accessibility.** Inactive states use `<Button disabled aria-disabled="true" aria-describedby={reasonId}>` so the button drops from tab order and screen readers get the reason from the subtitle paragraph. Two distinct ids are used so both surfaces can render simultaneously without an `id` collision (`register-cta-reason` for the sidebar, `register-cta-mobile-reason` for the mobile bar).
7. **Price hint hidden in `closed_window` / `event_ended`** so the UI never reads "From ₹799 — Registration closed". Shown in `open` and `not_yet_open`. Hidden in the SSR `unknown` baseline so cached HTML never advertises a "From ₹X" anchor before live state is known.
8. **Phase-3 placeholder route at `/events/:slug/register`** (`apps/web/src/routes/_public/events/$slug/register.tsx`):
   - `head()` emits `{ name: "robots", content: "noindex, nofollow" }` and a literal `<title>Register — eventKart</title>` so the placeholder cannot land in search results.
   - Loader sets `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (matches I-2.1.1's CDN contract — anonymous content, no `Vary: Cookie`, no per-user response).
   - Renders a neutral "Booking flow coming soon" placeholder with a "Back to event" link to `/events/$slug`.
   - Inner `RegisterPlaceholder({ slug })` component is exported separately so it can be unit-tested without a router context.
9. **Route refactor for routing safety.** The previous `apps/web/src/routes/_public/events/$slug.tsx` is moved to `apps/web/src/routes/_public/events/$slug/index.tsx` so a sibling `register.tsx` route can exist without nesting under an Outlet. `routeTree.gen.ts` regenerates cleanly (`PublicEventsSlugIndexRoute` + `PublicEventsSlugRegisterRoute`).
10. CDN cache contract from I-2.1.1 preserved on `/events/:slug` (no extra `Vary: Cookie`, no shorter `s-maxage`). The CTA reads only from the loader's `event` prop and `Date.now()`; no env reads, no I/O, no cookie reads.
11. No edits outside `apps/web/**` and the three docs files (`progress.md`, `docs/v1-implementation-plan.md`, this file).
12. `pnpm --filter web check-types`, `lint`, `test` all pass with no regressions.

## Key Decisions

- **D1 — SSR baseline `"unknown"` with neutral copy + an active link.** Two patterns were considered: (a) render the SSR baseline as `"open"` so the CTA is interactive immediately for the cached-HTML reader, (b) render `"unknown"` with neutral copy + an active link to the booking flow. Option (a) was rejected because cached HTML can be served days after a registration window has closed — a stale "Register now" link to the booking flow would mislead a screen reader into asserting availability. Option (b) keeps the link interactive (so the cached-HTML reader can still proceed; the booking flow itself will gate on live state) while the copy stays truthful: "Booking opens with our launch — check back soon." After mount the state refines and the copy/button transitions accordingly.
- **D2 — Single chained `setTimeout` (not `setInterval`).** A `setInterval(check, 60_000)` would either fire too often (wasting cycles) or not refresh near a boundary (a 60s interval could miss a boundary by 59s in the worst case). The chained timer fires precisely once per boundary, at the boundary, with a 1ms safety margin. `getNextBoundaryMs` returns `Math.min(...)` of the future boundaries; when none remain the chain stops.
- **D3 — Cap delay at `2 ** 31 - 1`(≈24.8 days).** Node clamps`setTimeout`delays larger than the largest signed 32-bit integer to 1ms (and emits`TimeoutOverflowWarning`). Without the cap, a future event scheduled months out would cause a tight loop in real-time tests. With the cap, the timer fires after ~24.8 days, re-checks the boundary, and schedules the next chunk. In practice this only matters for tests rendering with real timers far before any boundary.
- **D4 — Boundary semantics: `<` for `not_yet_open`, `>=` for `closed_window` / `event_ended`.** A boundary is "passed" the instant `now == boundary`. Concretely: at `now == registrationClosesAt`, registration is closed; at `now == endAt`, the event has ended. The `+1ms` nudge in the timer delay ensures the boundary registers as passed even when the wall-clock arrives within the same millisecond.
- **D5 — `event_ended > closed_window > not_yet_open > open` precedence.** Encoded directly in `getRegistrationState` (each branch is checked in that order). Critical for the edge case of a past event with `registrationClosesAt > endAt` (e.g. an organizer accidentally set the close after the event end): the user sees "Event has ended" not "Registration closed".
- **D6 — Defensive parsing: fail-safe vs fail-closed.** Invalid `endAt` (the only required time bound) → `event_ended` (fail-safe — the user never sees "Register now" for a corrupted record). Invalid `registrationClosesAt` → `closed_window` (fail-closed — never advertise availability when we don't know if the window is still open). Invalid `registrationOpensAt` → ignored (a missing open is the same as no explicit open).
- **D7 — Hide the price hint in `closed_window` / `event_ended` / `unknown`.** Otherwise the page reads "From ₹799 — Registration closed" which is internally inconsistent (a price anchor for a thing the user cannot buy). Visible in `open` (real availability) and `not_yet_open` (price is informational, not a CTA anchor).
- **D8 — Disabled `<Button disabled aria-disabled="true">` (not a styled link).** Drops the disabled CTA from tab order, surfaces the reason via `aria-describedby` pointing at the visible subtitle paragraph (no `aria-hidden`, no off-screen text). Native `<button disabled>` is the most assistive-tech-portable signal we can give.
- **D9 — Route refactor over nested-layout.** Two routing options were considered: (a) keep `$slug.tsx` and add a child Outlet for `register`, (b) move to a folder (`$slug/index.tsx` + `$slug/register.tsx`). Option (a) would require the page to render an Outlet that takes over its viewport when the user is on `/register`, which couples the two pages and is hostile to caching the page route. Option (b) is the canonical TanStack Router pattern for sibling routes that share a path prefix.
- **D10 — Phase-3 placeholder route is `noindex, nofollow`.** A placeholder must not land in search results — when the real booking flow ships in Phase 3, it will replace the route's content but search engines may still hold the placeholder snippet. `noindex` keeps the URL searchable but excluded from the index; `nofollow` instructs not to traverse outbound links from the placeholder (it has none meaningful, but the directive is conservative).
- **D11 — `getCtaLabels` exported as the single source of truth.** Two separate components render the CTA (sidebar + mobile bar). Centralising the labels in one switch ensures any future state addition (e.g. `sold_out`) is a one-file change and the two surfaces can never drift.

## Implementation Tasks

| #   | Task                                                                                                                                                                                                               | File(s)                                                                                                                                         | Status                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Helper module: `RegistrationState` type, `getRegistrationState`, `getNextBoundaryMs`, `formatRegistrationDate`, `getBookingHref`, `useRegistrationState` hook                                                      | `apps/web/src/features/event-detail/registration.ts`                                                                                            | ✅ Complete (2026-04-29) |
| 2   | Helper unit tests (state transitions, defensive parsing, boundary equality, scheduler, format fallback) — 21 tests                                                                                                 | `apps/web/src/features/event-detail/registration.test.ts`                                                                                       | ✅ Complete (2026-04-29) |
| 3   | Sidebar CTA: state-aware copy + active `<Link>` / disabled button + price-hint gating + `getCtaLabels` source of truth                                                                                             | `apps/web/src/features/event-detail/components/public-event-register-cta.tsx`                                                                   | ✅ Complete (2026-04-29) |
| 4   | Mobile bar CTA: mirror of sidebar, imports `getCtaLabels`                                                                                                                                                          | `apps/web/src/features/event-detail/components/public-event-sticky-mobile-cta.tsx`                                                              | ✅ Complete (2026-04-29) |
| 5   | Page integration tests: SSR-neutrality (`renderToString`), live `open` / `not_yet_open` / `closed_window` / `event_ended` states, both-null window, mid-page transition (`vi.advanceTimersByTime` past `closesAt`) | `apps/web/src/features/event-detail/components/public-event-page.test.tsx` (new `describe("PublicEventPage registration CTA (I-2.1.7)")` suite) | ✅ Complete (2026-04-29) |
| 6   | Route refactor: move `$slug.tsx` → `$slug/index.tsx` so a sibling `register` route can be added                                                                                                                    | `apps/web/src/routes/_public/events/$slug/index.tsx` (moved from `$slug.tsx`)                                                                   | ✅ Complete (2026-04-29) |
| 7   | Phase-3 placeholder route + `head()` (`noindex, nofollow` + literal title) + loader cache headers                                                                                                                  | `apps/web/src/routes/_public/events/$slug/register.tsx`                                                                                         | ✅ Complete (2026-04-29) |
| 8   | Placeholder route component tests                                                                                                                                                                                  | `apps/web/src/routes/_public/events/$slug/register.test.tsx`                                                                                    | ✅ Complete (2026-04-29) |
| 9   | Plan + GPT-5.5 plan review (rubber-duck pre-impl) + GPT-5.5 code review (post-impl)                                                                                                                                | session plan + reviews                                                                                                                          | ✅ Complete (2026-04-29) |
| 10  | Integrated validation                                                                                                                                                                                              | `pnpm --filter web {check-types,lint,test}`                                                                                                     | ✅ Complete (2026-04-29) |

## Validation Evidence

- `pnpm --filter web check-types` — passed (exit 0).
- `pnpm --filter web lint` — passed (exit 0; Biome 181 files, 0 warnings).
- `pnpm --filter web test` — passed (31 files, **301 tests**; **24 new** across `registration.test.ts` (21), `register.test.tsx` (3), and the I-2.1.7 page suite (7), with one existing organizer-summary test rewritten to assert post-mount copy on a frozen clock).
- GPT-5.5 plan review (rubber-duck pre-impl) — surfaced **4 findings** that shaped the implementation:
  1. **Critical** — Original plan had a child `register.tsx` under a still-existent `$slug.tsx` route, which would force the page to render an Outlet that takes over its viewport. **Adopted** — moved `$slug.tsx` → `$slug/index.tsx` so the two routes are siblings under a shared folder, no Outlet on the page.
  2. **Important** — Original plan used a `setInterval(check, 60_000)` polling loop. **Adopted** — switched to a chained `setTimeout` precisely at each boundary; cap delay at `2^31 - 1` ms; `+1ms` boundary nudge; chain stops when no future boundary remains.
  3. **Important** — Original plan rendered the SSR baseline as `"open"` with "Register now" + an active link. **Adopted** — switched to `"unknown"` with neutral "Ready to race?" / "View registration" copy + an active link, so cached HTML never advertises a stale availability state.
  4. **Improvement** — Original disabled state used a styled `<Link>` with `aria-disabled` only. **Adopted** — switched to native `<Button disabled aria-disabled="true" aria-describedby={reasonId}>` so the disabled CTA actually drops from tab order.
- GPT-5.5 code review (post-impl, focused on SSR/hydration safety, timer correctness, state precedence, defensive parsing, A11y, route SEO, test pattern, type safety) — **no significant issues found**.

## Output Shape (sample, post-mount, `state = "open"`)

```html
<!-- Sidebar CTA -->
<div data-slot="card" id="register-coming-soon" class="…">
  <div data-slot="card-header">
    <div data-slot="card-title">Ready to race?</div>
  </div>
  <div data-slot="card-content">
    <p id="register-cta-reason" class="text-sm text-muted-foreground">
      Secure your spot now — registration is open for this event.
    </p>
    <div data-testid="price-from">From ₹799</div>
    <a
      href="/events/coimbatore-city-10k/register"
      aria-describedby="register-cta-reason"
    >
      <button …>Register now</button>
    </a>
  </div>
</div>
```

## Known Follow-Ups

- Real Phase-3 booking flow at `/events/:slug/register` (replaces the placeholder ship in this slice).
- `sold_out` state — depends on I-2.1.9 (spots-remaining badge) deciding the spots-remaining contract; will plug into `getRegistrationState` as a fifth state with precedence between `open` and `not_yet_open`.
- Early-bird countdown (I-2.1.10) will hang off the same `useRegistrationState` clock without a second polling source.
- `aria-live` announcement on boundary transitions — left out for V1; the user is unlikely to be staring at the CTA at the exact ms a boundary passes, and an `aria-live="polite"` would announce on every refresh including the SSR→live transition.

## Files Touched

- `apps/web/src/features/event-detail/registration.ts` (NEW)
- `apps/web/src/features/event-detail/registration.test.ts` (NEW)
- `apps/web/src/features/event-detail/components/public-event-register-cta.tsx` (MODIFIED — full rewrite; exports `getCtaLabels`)
- `apps/web/src/features/event-detail/components/public-event-sticky-mobile-cta.tsx` (MODIFIED — mirrors sidebar; imports `getCtaLabels`)
- `apps/web/src/features/event-detail/components/public-event-page.test.tsx` (MODIFIED — `vi.mock("@tanstack/react-router")` Link stub, organizer-summary test rewritten to use a fixed clock, new I-2.1.7 `describe` suite)
- `apps/web/src/routes/_public/events/$slug/index.tsx` (NEW — moved from `$slug.tsx`)
- `apps/web/src/routes/_public/events/$slug/register.tsx` (NEW — Phase-3 placeholder + exported inner `RegisterPlaceholder`)
- `apps/web/src/routes/_public/events/$slug/register.test.tsx` (NEW)
- `apps/web/src/routes/_public/events/$slug.tsx` (DELETED — superseded by `$slug/index.tsx`)
- `apps/web/src/routeTree.gen.ts` (REGENERATED by the vite-router plugin — `PublicEventsSlugIndexRoute` + `PublicEventsSlugRegisterRoute`)
- `docs/impl-plan/feature-2.1-I-2.1.7.md` (NEW — this file)
- `docs/v1-implementation-plan.md` (MODIFIED — Module 2.1 row 7 flipped to ✅)
- `progress.md` (MODIFIED — appended I-2.1.7 row + Module 2.1 status update)
