# I-2.1.1: Professional Event Page Layout (`/events/:slug`)

**Feature ID:** I-2.1.1 (also satisfies I-2.1.8 — mobile-first responsive design)
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-30)
**Dependencies:** I-1.2.1 — Event creation; I-1.2.2 — Categories; I-1.2.3 — Pricing; I-1.2.9 — Event images; I-1.2.10 — Slug generation + `slug_redirects`
**Downstream:** I-2.1.2 — Organizer info section; I-2.1.3 — Policy display; I-2.1.4 — Category & pricing breakdown; I-2.1.5 — Open Graph; I-2.1.6 — JSON-LD; I-2.1.7 — Register CTA; I-2.1.9 — Spots-remaining; I-2.1.10 — Early-bird countdown; I-2.4.1 — Cloudflare CDN; I-3.1.1 — Booking entry; I-3.3.3 — Booking confirmation page

## Scope

Public, anonymous, SSR event detail page at `/events/:slug` rendered for events whose status is `published` or `completed`. The page presents hero/route-map imagery, title, dates, location, description, organizer summary, categories, pricing tiers, and policies. The same response contract handles legacy slugs by emitting an HTTP 301 redirect to the current slug. The route ships with CDN-friendly cache headers and is fully mobile-first (subsumes I-2.1.8).

## Acceptance Criteria

1. Anonymous `GET /api/v1/events/by-slug/:slug` returns either the public event detail or a redirect payload — both gated on `isPubliclyReadableEventStatus` (`published` | `completed`). Drafts, `under_review`, `rejected`, and unknown slugs all return 404 with an indistinguishable response shape (no information disclosure).
2. Slug-redirect resolution refuses to leak unpublished events: a `slug_redirects` row whose target event is not publicly readable returns 404, not a redirect.
3. Self-referential redirect rows (`oldSlug === newSlug`) return 404 (loop guard).
4. Public response schemas live in `packages/shared/src/schemas/event-public-detail.ts` and expose only public fields — no internal ids, no `verificationStatus`, no `spotsRemaining`, no internal storage keys; the redirect payload contains only `{ kind: "redirect", newSlug }`.
5. Hero and route-map images are returned as fresh presigned download URLs (TTL 3600s). The slot is `null` when the image is missing or when storage is administratively disabled (`StorageUnavailableError` is the **only** swallowed error; all other signing failures propagate as 5xx).
6. Web SSR route `/events/:slug` consumes the discriminated union: `kind: "redirect"` → TanStack Router `redirect({ code: 301, replace: true })`; `kind: "event"` → resolves to `EventPublicDetail` only (loader never returns the union).
7. SSR responses set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` and **do not** set `Vary: Cookie` (the response is identical for all callers; setting `Vary: Cookie` would shred CDN hit rate).
8. The page is mobile-first responsive (single-column on small viewports, two-column ≥md), satisfying I-2.1.8 inline.
9. Client-side `staleTime` aligns with the CDN `s-maxage` window (60s).
10. The Register CTA renders "Registration coming soon" copy until Phase 3 booking is wired (no broken/disabled buttons that imply a future state).
11. API and web tests cover: published/completed positive paths, draft/under_review/rejected → 404, unknown slug → 404, redirect to published target, redirect target unpublished → 404, self-redirect → 404, multi-rename chain → terminal redirect, storage-disabled → null image slots, presigned URL TTL, non-`StorageUnavailableError` propagates as 5xx, loader 301 + 404 + cache-header behavior.

## Implementation Tasks

| #   | Task                                                                  | File(s)                                                                                                                         | Status                  |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Public detail Zod schemas (narrow DTOs, redirect omits `eventId`)     | `packages/shared/src/schemas/event-public-detail.ts`, `packages/shared/src/schemas/index.ts`                                    | ✅ Complete (2026-04-30) |
| 2   | API service (`lookupPublicEventBySlug`) + status/redirect/loop guards | `apps/api/src/modules/events/public-detail-service.ts`                                                                          | ✅ Complete (2026-04-30) |
| 3   | API route `GET /api/v1/events/by-slug/:slug` + response schema        | `apps/api/src/modules/events/routes.ts`, `apps/api/src/modules/events/schemas.ts`                                               | ✅ Complete (2026-04-30) |
| 4   | API tests (16 scenarios)                                              | `apps/api/test/modules/events/public-detail.test.ts`                                                                            | ✅ Complete (2026-04-30) |
| 5   | Web feature module (types, server fn, query, loader)                  | `apps/web/src/features/event-detail/{types,api.server,api,queries,loader}.ts`                                                   | ✅ Complete (2026-04-30) |
| 6   | Web components (Hero, DetailsSection, Categories, Pricing, Location, Organizer, Policy, RegisterCta, PublicEventPage) | `apps/web/src/features/event-detail/components/public-event-*.tsx`                                                              | ✅ Complete (2026-04-30) |
| 7   | SSR route w/ Cache-Control header and 301 redirect handling           | `apps/web/src/routes/_public/events/$slug.tsx`, `apps/web/src/routeTree.gen.ts`                                                 | ✅ Complete (2026-04-30) |
| 8   | Web tests (api.server, loader, page render — 14 tests)                | `apps/web/src/features/event-detail/{api.server.test.ts,loader.test.ts,components/public-event-page.test.tsx}`                  | ✅ Complete (2026-04-30) |
| 9   | Mobile-first responsive design (subsumes I-2.1.8)                     | `apps/web/src/features/event-detail/components/*`                                                                               | ✅ Complete (2026-04-30) |
| 10  | Plan + code review (GPT-5.5 rubber-duck + code-review)                | Session plan + review                                                                                                           | ✅ Complete (2026-04-30) |
| 11  | Integrated validation                                                 | shared/api/web check-types + lint + tests                                                                                       | ✅ Complete (2026-04-30) |

## Validation Evidence

- `pnpm --filter @repo/shared check-types` — passed.
- `pnpm --filter @repo/shared test` — passed (16 files, 169 tests).
- `pnpm --filter api check-types` — passed.
- `pnpm --filter api lint` — passed (9 pre-existing warnings outside this change).
- `pnpm --filter api test` — passed (46 files, 762 tests, including 16 new in `public-detail.test.ts`).
- `pnpm --filter web check-types` — passed.
- `pnpm --filter web lint` — passed.
- `pnpm --filter web test` — passed (25 files, 177 tests, including 14 new in `event-detail/`).
- GPT-5.5 plan review (1 critical + 7 important + 4 improvements) — all real findings adopted prior to implementation.
- GPT-5.5 code review on the full diff — no significant issues found.

## Baseline / Design Notes

- **API contract uses a discriminated union** (`{ kind: "event" | "redirect", ... }`) rather than HTTP 301 from the API itself. The web loader is what emits the SEO-correct 301 to the browser — this is simpler for `createServerFn` to consume and keeps the API endpoint cacheable independently of redirect semantics.
- **`eventId` deliberately removed from the redirect payload** — leaks no internal ids.
- **Loop guard is critical**: if `slug_redirects.newSlug === requestedOldSlug` (corrupt row), return 404; never emit a self-redirect or cause an infinite client loop.
- **Storage error policy**: only `StorageUnavailableError` is swallowed (image slot becomes `null`). All other S3/signing errors propagate as 5xx so production breakage is visible.
- **Cache + presigned URL math**: `s-maxage=60` + `stale-while-revalidate=300` ≈ ~6 min max stale; presigned URL TTL of 3600s gives ~50 min of safe overlap.
- **No `Vary: Cookie`** on the public route — the response is identical for all callers; adding `Vary: Cookie` would destroy CDN hit rate.
- **Mobile-first design** subsumes I-2.1.8 — the layout is built mobile-first and progressively enhanced for `md:`+ viewports.
- **Phase 2 deferrals tracked separately:**
  - I-2.1.2 — Organizer verification badge (organizer info section is present in stub form for I-2.1.1; full badge wiring lands with I-2.1.2).
  - I-2.1.3 — Policy display tabs/sections beyond plain prose (I-2.1.1 displays refund/cancellation policy text).
  - I-2.1.5 — Open Graph meta tags.
  - I-2.1.6 — JSON-LD Event schema.
  - I-2.1.7 — Register Now CTA wired to booking flow (placeholder copy is in place).
  - I-2.1.9 — Spots-remaining badge.
  - I-2.1.10 — Early-bird countdown timer.
  - I-2.4.1 — Cloudflare CDN configuration (route headers are CDN-ready).
- **Boundary respected**: the API and web sub-agents implemented in parallel and neither modified `packages/shared/**` or `packages/ui/**` — those edits were made by the planning step before delegation.
