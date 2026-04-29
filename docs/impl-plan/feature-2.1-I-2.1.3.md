# I-2.1.3: Policy Display (Refund & Cancellation) on `/events/:slug`

**Feature ID:** I-2.1.3
**Module:** 2.1 — Event Detail Page
**Status:** 🟡 In Progress (started 2026-04-29)
**Dependencies:** I-2.1.1 — Public event detail page (✅ Complete); I-1.2.5 — Refund & cancellation policy capture (✅ Complete)
**Downstream:** I-3.1.1 — Booking entry (will deep-link to `#policies` anchor); I-2.1.7 — Register CTA (final CTA wires the same anchor).

## Scope

Upgrade the public event detail page's policy display from plain prose
(`PublicEventPolicyText`) into a deliberately discoverable, deep-linkable
"Before you book" section that:

1. Renders refund and cancellation policies as **stacked subsections** in a
   single `Card` so both policy bodies are always present in the SSR HTML
   (crawlable, printable, deep-linkable). Tabs were considered and rejected
   — Radix `TabsContent` does not mount inactive panels by default, which
   would break the visible-before-booking guarantee for whichever policy is
   not the default tab.
2. Gracefully degrades to a single labeled subsection when only one of the
   two policies is present, and renders an explicit **fallback card** when
   both are `null` ("This event has no published refund or cancellation
   policy.") so the trust surface is never silently empty for `published`
   or `completed` events that may have legacy seed data missing the
   policies the I-1.2.5 publish gate now enforces.
3. Exposes anchors at three granularities so booking, support, and
   confirmation copy can deep-link cleanly:
   - `id="policies"` on the section wrapper
   - `id="refund-policy"` on the refund subsection
   - `id="cancellation-policy"` on the cancellation subsection

   Each anchor carries `scroll-mt-24` to align with the existing public
   header offset already used by `PublicEventRegisterCta`.
4. Carries **organizer identity** inline with the trust framing so the
   participant knows whose terms they are reading: the section accepts
   the public organizer summary and the description copy reads
   "Review {organizer.businessName}'s refund and cancellation terms
   before booking." — directly satisfying F-2.1.3 ("alongside clear
   organizer identity and trust information"). The standalone organizer
   sidebar card is preserved so identity remains visible above the fold
   on desktop.
5. Avoids platform-guarantee implications: no `ShieldCheck` icon, no
   "verified policy" copy. The icon (if any) is a decorative `FileText`
   marked `aria-hidden`. The intent is "trust through clarity", not
   "EventKart guarantees this organizer's refund."
6. Preserves XSS-safe rendering — policies are plain text rendered through
   React text nodes (no `dangerouslySetInnerHTML`, no markdown, no link
   autodetection), with `whitespace-pre-line` for organizer-authored line
   breaks. A test asserts that `<script>` payloads in policy text render
   as escaped text and create no DOM nodes.

This feature is **frontend-only**: no API, schema, or database changes.
The public event detail API contract already exposes
`refundPolicy: string | null` and `cancellationPolicy: string | null`
through `eventPublicDetailSchema` (shipped with I-2.1.1) and the publish
gate (I-1.2.6 + I-1.2.5) requires both to be set before an event becomes
publicly readable, so the both-null branch is a defensive fallback rather
than a happy-path state.

## Acceptance Criteria

1. A new `PublicEventPolicySection` component renders under the main
   column of `/events/:slug` inside a shadcn `Card`. The card uses
   `CardHeader` + `CardTitle` ("Before you book") + `CardDescription`
   (organizer-named trust copy) + `CardContent` (the stacked policy
   subsections). The wrapping element is `<section id="policies"
   aria-labelledby="policies-heading" className="scroll-mt-24">` and the
   `CardTitle` carries `id="policies-heading"`.
2. When **both** `refundPolicy` and `cancellationPolicy` are non-null,
   the section renders two stacked subsections — refund first, then
   cancellation — each wrapped in `<section id="refund-policy">` and
   `<section id="cancellation-policy">` (both carrying `scroll-mt-24`),
   with H3 headings and the policy text as `whitespace-pre-line` plain
   text. Both bodies are present in the SSR HTML.
3. When **only one** policy is present, the section renders only that
   subsection with the same per-policy anchor and H3 heading. The
   "Before you book" card frame and the organizer-named description
   remain.
4. When **both** policies are `null`, the section renders an explicit
   fallback card with the same `id="policies"` anchor and a neutral
   message: "This event has no published refund or cancellation policy."
   It does **not** silently render nothing.
5. The wrapping `<section>` uses `aria-labelledby="policies-heading"` so
   screen readers can land on the section via landmarks. Each subsection
   has its own H3 heading; the section heading is the H2.
6. The sidebar `PublicEventRegisterCta` renders a compact text link
   "Review refund & cancellation policies" pointing at `#policies`. The
   mobile bottom-bar secondary link is **deferred to I-2.1.7** to keep
   the bottom bar uncluttered above the global mobile nav.
7. Anchored navigation respects `scroll-mt-24` so the section and each
   per-policy subsection are not hidden under the sticky header (header
   is 56–64px; `scroll-mt-24` = 96px is consistent with the existing
   register CTA pattern).
8. Trust framing is XSS-safe: the policy strings are rendered as React
   text nodes only. A test asserts that an attempted `<script>` payload
   in policy text renders as escaped text and produces no `script` /
   `b` DOM nodes.
9. The component has no client-only deps and adds no new npm packages.
10. **Tests** cover:
    - Both policies → both H3 headings, both per-policy anchors, both
      bodies present.
    - Refund-only → cancellation heading/anchor absent.
    - Cancellation-only → refund heading/anchor absent.
    - Both-null → fallback card present (with `#policies` anchor) and
      no policy headings.
    - XSS payload in policy text renders as escaped text, zero
      `<script>` nodes.
    - Multiline policy (`Line 1\nLine 2`) renders both lines (CSS-driven
      via `whitespace-pre-line`).
    - Section description copy includes the organizer's `businessName`.
    - Sidebar CTA renders a link with `href="#policies"`.
11. No regressions in the existing `public-event-page.test.tsx` policy
    guard test (refund/cancellation copy still appears for the populated
    fixture).

## Files Touched

| File                                                                                               | Change | Notes                                                                  |
| -------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `apps/web/src/features/event-detail/components/public-event-policy-section.tsx`                    | NEW    | Tabs + single-section + null-guard component.                          |
| `apps/web/src/features/event-detail/components/public-event-policy-text.tsx`                       | DELETE | Superseded by the new section.                                         |
| `apps/web/src/features/event-detail/components/public-event-page.tsx`                              | EDIT   | Swap the policy import; render `PublicEventPolicySection`.             |
| `apps/web/src/features/event-detail/components/public-event-register-cta.tsx`                      | EDIT   | Add the secondary "Review refund & cancellation policies" anchor link. |
| `apps/web/src/features/event-detail/components/public-event-page.test.tsx`                         | EDIT   | Extend policy guard test + add new tests for tabs/single/null/XSS/CTA. |
| `docs/impl-plan/feature-2.1-I-2.1.3.md`                                                            | NEW    | This plan.                                                             |
| `docs/v1-implementation-plan.md`                                                                   | EDIT   | Flip the I-2.1.3 status row.                                           |
| `progress.md`                                                                                      | EDIT   | Mark I-2.1.3 complete; update Module 2.1 status.                       |

## Validation Plan

```sh
pnpm --filter web check-types
pnpm --filter web exec vitest run src/features/event-detail/
pnpm --filter web lint
```

Shared-contract changes are not in scope; we still re-run
`pnpm --filter @repo/shared check-types` to confirm the public detail
schema continues to satisfy the section's expected props.

## Risk Classification

🟡 Medium — frontend-only refinement of an already-public surface, no
auth/payments/personal data, no schema or API change. Reviewer: **GPT-5.5**
(per user policy: review with GPT-5.5 always).

## Rollback

```
git checkout HEAD -- apps/web/src/features/event-detail/components/ \
                     apps/web/src/features/event-detail/components/public-event-page.test.tsx
git rm apps/web/src/features/event-detail/components/public-event-policy-section.tsx
git checkout HEAD -- apps/web/src/features/event-detail/components/public-event-policy-text.tsx
```

Or simply `git revert` the I-2.1.3 commit on `anvil/i-2-1-3-policy-display`.

## Notes / Assumptions

- We deliberately omit a "policy last updated at" timestamp because the
  public event detail schema does not surface `policiesUpdatedAt`, and
  I-2.1.3 is not authorized to change the public schema. Surfacing that
  metadata can land with I-1.2.8 follow-ups when audit timestamps are
  added to the public projection.
- Trust copy is intentionally non-promotional — it names the organizer
  and points participants at the policies they should read; it does
  **not** imply EventKart's own refund guarantee. No `ShieldCheck` or
  similar guarantee-implying iconography is used.
- Iconography (if any) uses `lucide-react` (already a transitive dep via
  shadcn); no new package is added. Any icon used is decorative
  (`aria-hidden="true"`).
- The mobile bottom-bar secondary anchor is intentionally deferred to
  I-2.1.7 (Register CTA) to avoid cluttering the bar above the global
  mobile nav before booking actually exists.
- The other in-flight branch `anvil/i-2-1-4-pricing-breakdown` is being
  developed in parallel and will also touch `public-event-page.tsx`.
  Conflict surface is bounded to one import line and one JSX element
  swap; merge resolution is the user's responsibility.

## GPT-5.5 Plan Review (adopted findings)

A pre-implementation review by GPT-5.5 raised:

- **Critical** — Tabs would not SSR inactive panels (Radix default). →
  Adopted: stacked sections instead.
- **Critical** — "Alongside organizer identity" was not honored by a
  generic trust line. → Adopted: organizer `businessName` is named in
  the section description.
- **Important** — Both-null silent omission weakens trust on edge data.
  → Adopted: explicit fallback card.
- **Important** — Per-policy anchors needed for downstream deep-linking.
  → Adopted: `#refund-policy` and `#cancellation-policy`.
- **Important** — `ShieldCheck` implies platform guarantee. → Adopted:
  no platform-guarantee iconography.
- **Important** — Mobile bottom-bar secondary link risks clutter. →
  Adopted: defer to I-2.1.7.
- **Important** — Lock down XSS contract; tests assert no DOM injection.
  → Adopted in test list.
- **Improvements** — Card composition + organizer-name test + multiline
  test. → All adopted.
