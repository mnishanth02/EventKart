# I-2.1.2: Organizer Info Section with Verification Badge (`/events/:slug`)

**Feature ID:** I-2.1.2
**Module:** 2.1 — Event Detail Page
**Status:** ✅ Complete (2026-04-30)
**Dependencies:** I-2.1.1 — Public event detail page; I-1.1.1 — Organizer registration; I-1.1.6 — Verification badge assignment
**Downstream:** I-2.3.1 — Organizer profile page (link target); I-2.4.2 — Event-page cache invalidation on organizer profile updates

## Scope

Replace the placeholder organizer card on the public event detail page (`/events/:slug`) with a real "About the organizer" section that surfaces the organizer's identity, verification status, location, self-authored description, and a link to the (forthcoming) organizer profile page. The change is end-to-end: it threads the organizer description through the public event payload via a contract change in `packages/shared`, normalizes/truncates it defensively in the API service, and renders it accessibly on the SSR public detail page.

## Acceptance Criteria

1. The public event response (`GET /api/v1/events/by-slug/:slug` for `kind: "event"`) returns an `organizer` object that includes `description: string | null` in addition to the existing `slug | businessName | isVerified | city`.
2. The embedded organizer `slug` is typed as a branded `OrganizerSlug` (`organizerSlugSchema`) so callers cannot accidentally pass an arbitrary string into URL templates.
3. The API never 5xx's the public event response because of a malformed organizer description: empty/whitespace strings are normalized to `null`, and any description longer than 2000 characters is defensively truncated to 2000 characters before the schema parse.
4. The web `PublicEventOrganizerCard` renders:
   - Title `"About the organizer"`.
   - Business name with `<VerifiedBadge variant="inline" />` rendered next to it when `isVerified` is `true`, and absent when `false`.
   - `Based in {city}` muted line.
   - The description in a paragraph with `whitespace-pre-line` so organizer-entered line breaks are preserved, rendered as React-escaped text only (no `dangerouslySetInnerHTML`).
   - A profile link to `/organizers/${organizer.slug}` with `aria-label="View profile of {businessName}"` and visible copy `View organizer profile →`.
5. The profile link is rendered as a plain `<a>` element with an inline `// TODO(I-2.3.1):` comment explaining the swap to TanStack `<Link to="/organizers/$slug">` once the route lands. Until then, full-document navigation to the (current) 404 is acceptable per the v1 plan.
6. The API tests cover all four description paths (verbatim, `null`, empty/whitespace → `null`, oversized → truncated). The web tests cover card title, badge a11y (via `getByLabelText("Verified organizer")`), profile link href + `aria-label`, description rendering when null/non-null, XSS-safe text rendering of HTML-bearing input, and a max-length (2000-char) description does not crash the component.
7. The CDN contract from I-2.1.1 is preserved: response remains identical for all callers, no `Vary: Cookie`, same `Cache-Control` header.

## Implementation Tasks

| #   | Task                                                                                                                | File(s)                                                                                                            | Status                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | Branded `organizerSlugSchema` (mirrors `eventSlugSchema`) + `index.ts` re-exports                                   | `packages/shared/src/schemas/organizer-slug.ts`, `packages/shared/src/schemas/index.ts`                            | ✅ Complete (2026-04-30) |
| 2   | `eventPublicOrganizerSummarySchema` uses `organizerSlugSchema` for `slug`; adds `description` (nullable, max 2000)  | `packages/shared/src/schemas/event-public-detail.ts`                                                               | ✅ Complete (2026-04-30) |
| 3   | API `selectOrganizerSummary` selects `organizers.description`, normalizes empty/whitespace → `null`, truncates 2000, returns via `eventPublicOrganizerSummarySchema.parse(...)` | `apps/api/src/modules/events/public-detail-service.ts`                                                             | ✅ Complete (2026-04-30) |
| 4   | API tests (4 description scenarios)                                                                                 | `apps/api/test/modules/events/public-detail.test.ts`                                                               | ✅ Complete (2026-04-30) |
| 5   | Replace `PublicEventOrganizerCard` stub with real card (title, badge, "Based in", description, profile link + TODO) | `apps/web/src/features/event-detail/components/public-event-organizer-card.tsx`                                    | ✅ Complete (2026-04-30) |
| 6   | Web tests (5 organizer-card scenarios) + fixture updates (`description: null`)                                      | `apps/web/src/features/event-detail/components/public-event-page.test.tsx`, `api.server.test.ts`, `loader.test.ts` | ✅ Complete (2026-04-30) |
| 7   | Plan + code review (GPT-5.5 rubber-duck plan-review + GPT-5.5 code-review)                                          | Session plan + review                                                                                              | ✅ Complete (2026-04-30) |
| 8   | Integrated validation (shared/api/web check-types + tests)                                                          | —                                                                                                                  | ✅ Complete (2026-04-30) |

## Validation Evidence

- `pnpm --filter @repo/shared check-types` — passed.
- `pnpm --filter @repo/shared test` — passed (16 files, 169 tests).
- `pnpm --filter api check-types` — passed.
- `pnpm --filter api test -- test/modules/events/public-detail.test.ts` — passed (21 tests, including the 4 new description scenarios).
- `pnpm --filter web check-types` — passed.
- `pnpm --filter web test -- src/features/event-detail` — passed (3 files, 19 tests, including the 5 new organizer-card scenarios).
- GPT-5.5 plan review (5 Important findings) — all adopted before implementation: (a) normalize empty/whitespace description → `null`, (b) defensive 2000-char truncation in the API, (c) branded `organizerSlugSchema`, (d) inline `TODO(I-2.3.1)` comment, (e) badge a11y via `getByLabelText`.
- GPT-5.5 code review on the staged commit — see commit `468f5b7`.

## Design Notes

- **Branded slug at the contract boundary.** The embedded `organizer.slug` is typed as `OrganizerSlug` (a Zod-branded string) rather than `string`. This forces the link rendering path to go through the validated schema and prevents accidental composition with un-validated user input.
- **Defensive truncation in the API.** The DB column `organizers.description` is unbounded `text`. The shared schema caps `description` at 2000 chars. The API service slices to 2000 chars *before* parse, so a single oversized row cannot 5xx the entire public event response. The 2000-char limit matches the existing `organizerRegistrationSchema` ceiling.
- **Empty-string normalization.** Trimming and converting empty/whitespace-only descriptions to `null` keeps the rendering path consistent with absent descriptions and avoids rendering an empty paragraph.
- **XSS safety by construction.** The component renders the description as a React text node inside a paragraph element with `whitespace-pre-line`. There is no `dangerouslySetInnerHTML` and no parsing of organizer-supplied markup. This is verified by a unit test that feeds `<script>` and `<b>` tags as description text and asserts the literal text is rendered while the elements are not present in the DOM.
- **Link strategy and the I-2.3.1 transition.** The profile link uses a plain `<a href="/organizers/${slug}">` with an inline `// TODO(I-2.3.1):` comment. Using `<Link to>` would require the route to exist in `routeTree.gen.ts`, which it does not yet. Until then, the link will 404 if clicked — explicitly documented in the v1 plan note for I-2.1.2 ("wired to I-2.3.1 when built"). When I-2.3.1 lands, swap the anchor for `<Link to="/organizers/$slug" params={{ slug: organizer.slug }}>`.
- **Cache invariants from I-2.1.1 preserved.** No new `Vary` headers, same `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Response remains identical for all callers.
- **Downstream cache-invalidation note for I-2.4.2.** The public event response now embeds the organizer description. When I-2.4.2 wires up event-page cache purges, it MUST also purge an event's CDN entry whenever its organizer's profile is updated (organizer description, business name, city, or verification status changes), or stale organizer info will linger in the CDN until the `s-maxage` window elapses. Owner: I-2.4.2.

## Boundary Respected

This implementation strictly stays within the I-2.1.2 scope. It does not introduce the organizer profile route (I-2.3.1), the policy display tabs (I-2.1.3), the category/pricing breakdown (I-2.1.4), Open Graph meta (I-2.1.5), JSON-LD (I-2.1.6), the wired Register CTA (I-2.1.7), the spots-remaining badge (I-2.1.9), or the early-bird countdown (I-2.1.10).
