# I-2.3.4 — Verification Status Explanation Copy

**Status:** ✅ Complete (2026-04-30)
**V1 plan row:** `docs/v1-implementation-plan.md` row 509
**Scope:** Frontend-only product copy + a single shared component (two variants) + two render-site wirings + tests. Explains verification as an onboarding/policy check, not a quality/safety guarantee.

---

## Goal

Land the F-2.3.4 trust copy so any surface that shows a verified badge also explains, in canonical EventKart wording, what verification actually means. Wording is sourced verbatim from `docs/requirements.md` §4.1 ("Verification must be explained as a EventKart onboarding and policy check, not a blanket guarantee of event quality or safety") so future surfaces can render the explainer without re-litigating the wording.

---

## Source of truth

- `docs/requirements.md:233-236` — F-2.3.4 acceptance: "Verification status explanation copy that describes verification as an onboarding and policy check, not a blanket guarantee of event quality or safety".
- `docs/requirements.md:392-395` — §4.1 Trust requirement (canonical wording source).
- `docs/v1-implementation-plan.md:509` — row I-2.3.4.

---

## Approved design

### 1. Copy constant — `packages/ui/src/lib/verification-copy.ts` (NEW)

Single source of truth for all surfaces:

```ts
export const VERIFICATION_EXPLANATION = {
	triggerLabel: "What does verified mean?",
	heading: "Verification is an onboarding check",
	body: "EventKart verifies organizers' business details and refund/cancellation policies during onboarding. Verification is not a guarantee of event quality, safety, or specific outcomes.",
} as const;
```

Plain ASCII apostrophe consistently. No liability claims, no support-routing copy, no FAQ pointers — strictly the §4.1 contract.

### 2. Component — `packages/ui/src/components/verification-explainer.tsx` (NEW)

Sibling of `verified-badge.tsx`. Two variants, both rendering the same copy constant:

- **`inline-note`** (default): subtle muted card (`rounded-md`, `border-border/50`, `bg-muted/40`) with a `<ShieldCheck>` icon (lucide-react, 4×4) followed by heading (semibold, `text-foreground`) and body (`text-xs leading-5`). Accepts an optional `id` prop so callers can anchor-link (used as `id="about-verification"`).
- **`popover`**: underlined dotted trigger reading the constant's `triggerLabel`. Opens a Radix `Popover` (from `@repo/ui/components/ui/popover`) showing heading + body in a `max-w-xs` content card. Trigger is keyboard-accessible (focusable, Enter/Space activates) — Radix's `PopoverTrigger` returns a `<button>`.

Both variants compose existing primitives. JSDoc on the component documents the two variants and their intended surfaces.

### 3. Wire to organizer profile

`apps/web/src/features/organizer-detail/components/PublicOrganizerProfile.tsx` — adds the inline-note explainer inside `CardHeader`, immediately after the "Based in {city}" line, gated on `profile.isVerified === true`. Anchor id `about-verification` set so future deep-links work.

### 4. Wire to event organizer card

`apps/web/src/features/event-detail/components/public-event-organizer-card.tsx` — adds `<VerificationExplainer variant="popover" />` inline, immediately after `<VerifiedBadge variant="inline" />`, both wrapped in a fragment gated on `organizer.isVerified === true`. The popover trigger sits in the same flex row as the badge so the affordance reads as part of the badge cluster, not a separate row. The existing typed `<Link to="/organizers/$slug">` from I-2.3.1 is unchanged.

---

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Copy lives in `packages/ui/src/lib/`** — not in `apps/web`. Future second consumers (admin organizer dashboard, future "verified organizer" widgets in another app) will reuse the same constant; the explainer must never drift between surfaces.    |
| D2  | **Two variants, one constant.** Inline-note suits the dedicated organizer profile (always on, no extra click). Popover suits the dense event-detail card where vertical space is tight and the explainer should stay opt-in.                            |
| D3  | **Render only when `isVerified === true`.** Unverified organizers don't show a badge, so an explainer would be confusing ("explaining what?"). When verification is added later via admin flow, the explainer light up alongside the badge.             |
| D4  | **No support-routing language.** §4.1 line 396 ("report issues to EventKart support") is a separate requirement; that copy belongs to a future support-routing feature, not I-2.3.4. The explainer is strictly about the *meaning* of verification.     |
| D5  | **Tests live in `apps/web`, not `packages/ui`.** `@repo/ui` has no vitest setup (no `test` script, no jsdom, no testing-library). The explainer is exercised by web tests through the `@ui/*` Vite alias already configured in `apps/web/vitest.config.ts`. |
| D6  | **Body equals constant verbatim assertion.** Tests pin `body.textContent === VERIFICATION_EXPLANATION.body` so any accidental wording drift fails CI; a separate copy guard asserts every match of `guarantee` lives inside the canonical "not a guarantee" clause. |
| D7  | **Radix pointer-capture polyfill** in the event-page test file — copied from `events-list-sort-select.test.tsx`. Required because jsdom lacks `Element.prototype.hasPointerCapture` etc. and `userEvent.click` on a Radix popover trigger would otherwise throw. |
| D8  | **No `"use client"` directive.** TanStack Start (Vite + React 19) does not use Next.js client/server boundaries; the popover renders fine in SSR via Radix's portal-on-mount pattern.                                                                    |

---

## Files changed

### Created
- `packages/ui/src/lib/verification-copy.ts` — copy constant.
- `packages/ui/src/components/verification-explainer.tsx` — two-variant component.
- `apps/web/src/components/verification-explainer.test.tsx` — 7 tests (variants, copy guard).
- `docs/impl-plan/feature-2.3-I-2.3.4.md` — this file.

### Modified
- `apps/web/src/features/organizer-detail/components/PublicOrganizerProfile.tsx` — adds inline-note explainer (verified-only) with `id="about-verification"`.
- `apps/web/src/features/organizer-detail/components/PublicOrganizerProfile.test.tsx` — +2 cases (rendered when verified, hidden when not).
- `apps/web/src/features/event-detail/components/public-event-organizer-card.tsx` — adds popover variant inline next to the verified badge (verified-only).
- `apps/web/src/features/event-detail/components/public-event-page.test.tsx` — +3 cases (trigger present + focusable when verified, absent when unverified, body revealed on click) + Radix pointer-capture polyfill.
- `docs/v1-implementation-plan.md` — row 509 marked complete with summary.
- `progress.md` — appended row #73.

---

## Test inventory

### `apps/web/src/components/verification-explainer.test.tsx` (7 tests)

**inline-note**
- Renders heading and body verbatim from `VERIFICATION_EXPLANATION`.
- Uses provided `id` on the rendered container.
- Does not render the popover trigger label.

**popover**
- Renders trigger label; body hidden until activation.
- Reveals heading + body verbatim on click.
- Trigger is focusable (keyboard accessible).

**Copy guard**
- Every match of `guarantee[d]?` lives inside the canonical "not a guarantee" clause.

### `apps/web/src/features/organizer-detail/components/PublicOrganizerProfile.test.tsx` (+2 cases, 9 total)
- Renders explainer (with anchor id `about-verification`) when verified.
- Hides explainer when unverified.

### `apps/web/src/features/event-detail/components/public-event-page.test.tsx` (+3 cases on `PublicEventOrganizerCard`)
- Popover trigger present + focusable when verified, body initially hidden.
- Trigger absent when unverified.
- Activating the trigger reveals heading + body (body verbatim equality).

---

## Validation evidence

```text
pnpm --filter @repo/ui check-types  → exit 0
pnpm --filter web check-types       → exit 0
pnpm --filter web test              → 495/495 (+12 from baseline 483)
pnpm --filter web lint              → exit 0
pnpm --filter @repo/ui lint         → exit 0
```

---

## Out of scope (deferred)

- Cross-link from organizer admin/dashboard surfaces to the same explainer (I-1.1.4 verification dashboards already shipped; backlinking is a separate small task).
- Support-routing copy ("report issues to EventKart support", §4.1 line 396) — belongs to a dedicated future support-routing feature.
- FAQ page / detailed verification policy doc — V1 keeps the explanation in-product only.
- Localization — V1 ships English copy only.

---

## Workflow notes

- Followed `.github/prompts/eventkart-dev-workflow.prompt.md` with the "Escape Hatch (small reversible work)" rule: skipped Plan Review and Code Review phases (single shared component + two wiring sites + tests; copy is sourced verbatim from spec, no design alternatives to weigh).
