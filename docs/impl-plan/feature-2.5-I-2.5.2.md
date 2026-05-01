# I-2.5.2 — `/terms` page (Terms of Service)

**Module:** 2.5 (Public Chrome & Legal Pages)
**Feature ID:** I-2.5.2
**Source row:** `docs/v1-implementation-plan.md` Module 2.5 row 2 (file row 546)
**Status:** ✅ Complete

---

## 1. Scope

Ship a SSR, CDN-cacheable `/terms` page at
`apps/web/src/routes/_public/terms.tsx` (~165 LOC) covering EventKart's
participant-facing platform terms. The page is versioned and the displayed
`Version` label is sourced from `PARTICIPANT_LEGAL_VERSIONS.terms` in
`@repo/shared/constants` so the page label and the booking-time
`consent_records.consent_version` stamp for the `booking_terms` document
family stay in lockstep — bumping the constant is what triggers explicit
re-acceptance on the next booking submission (Phase 3).

Ten numbered sections rendered inside `LegalPageLayout`:

1. Acceptance of terms (records the version accepted).
2. Eligibility (18+; minor bookings need parental consent + guardian email
   captured on the form).
3. Account & identity (browse without an account; phone OTP at booking
   submission, not at signup).
4. Booking, payment, and fees (regulated payment gateway — Razorpay or
   Cashfree — payment-time split payout to organizer minus EventKart fee;
   booking confirmed only after successful payment).
5. Refund and cancellation framework (per-event policy; the policy displayed
   on the event page at booking time is recorded with the booking and does
   not change retroactively; escalation path = organizer first, then
   `<Link to="/contact">` and `<Link to="/privacy">`).
6. Organizer responsibilities (verification + the "first three paid events
   from a new organizer require manual review" pilot rule from product-plan).
7. Acceptable use (no fraud / harassment / Indian-law violations; repeat
   policy violations may trigger suspension).
8. **Disclaimer & liability boundaries** — verbatim wording from
   `docs/requirements.md` §4.1: "Verification must be explained as a
   EventKart onboarding and policy check, not a blanket guarantee of event
   quality or safety." Liability is limited to the booking amount paid
   through EventKart for that event.
9. Changes to terms (version bump → re-acceptance on next booking; prior
   version remains the version-of-record for prior bookings).
10. Governing law — India.

Cross-page references use typed `<Link to="/contact">`, `<Link to="/privacy">`
(no `<a href>` fallbacks). The route component splits into `TermsPage` (route
binding) and an exported `TermsContent` for direct unit testing without a
router shell.

## 2. Decisions / rationale

### Version label is read from `@repo/shared/constants`, not hardcoded

`PARTICIPANT_LEGAL_VERSIONS.terms` (currently `"1.0"`) is read at module
scope and rendered both in the H1 metadata line (via `LegalPageLayout`) and
inline in section 1 ("**Version {version}** at the time of writing"). The
booking flow's consent stamper (Phase 3) reads the same constant. The
intent is that a wording-only edit can ship without a version bump (no
re-consent), but a substantive edit bumps the constant in the same commit
so re-consent fires automatically — there is no second "register a new
terms version" step.

### Liability disclaimer is verbatim from requirements.md §4.1

Section 8's wording is copied verbatim, not paraphrased. The exact phrase
"Verification must be explained as a EventKart onboarding and policy check,
not a blanket guarantee of event quality or safety" is what the
verification-explainer copy (`packages/ui/src/lib/verification-copy.ts`,
shipped in I-2.3.4) and the requirements doc are aligned on. Three
surfaces, one phrasing — a copy guard test in
`verification-explainer.test.tsx` (I-2.3.4) ensures "guarantee" only
appears inside the canonical "not a guarantee" phrasing on those surfaces.
The same convention applies here.

### Refund framework is per-event, not platform-set

Section 5 explicitly states that the refund and cancellation policy is
organizer-defined, that the policy text in force at booking time is
captured with the booking record, and that EventKart's role is to enforce
that organizers display + stamp it. This is the contract that the Phase 3
booking flow's policy snapshot column is built against — if Phase 3 ever
moves to a platform-default refund policy, this section needs to change
first.

### Inner content split as `TermsContent` for unit testing

`TermsPage` is the route component. `TermsContent` is the pure body. The
split mirrors `RegisterPlaceholder` in `events/$slug/register.tsx` (I-2.1.7)
and the `ContactContent` / `AboutContent` / `PrivacyPage` / `FaqPageView`
splits in the rest of Module 2.5 — every Module 2.5 route can be rendered
in jsdom without booting `RouterProvider`.

### Module 2.5 shared infra

Cache headers (`LEGAL_PAGE_CACHE_CONTROL` — 1h fresh / 24h SWR), SEO helper
(`buildLegalPageHead` — emits canonical + `hreflang en` + `hreflang
x-default` gated on canonical resolving to an absolute URL),
`LegalPageLayout` (Tailwind typography wrapper), and `SUPPORT_EMAIL` are
all imported from `apps/web/src/features/legal-pages/`. See I-2.5.1 for the
full shared-infra rationale; the same `setLegalPageCacheHeaders` /
`buildLegalPageHead` pair is used here.

## 3. Verification

- **Page tests:** 15 colocated tests in
  `apps/web/src/routes/_public/terms.test.tsx` covering all ten section
  headings, the verbatim verification-disclaimer wording, the cross-page
  `<Link>` targets to `/contact` and `/privacy`, the version label, and
  the eligibility / governing-law copy.
- `pnpm --filter @repo/shared check-types` ✓
- `pnpm --filter @repo/shared test` ✓ — 197/197.
- `pnpm --filter web check-types` ✓
- `pnpm --filter web lint` ✓ (Biome clean)
- `pnpm --filter web test` ✓ — 649/649.

## 4. Future-proofing notes

1. **Substantive edits → bump `PARTICIPANT_LEGAL_VERSIONS.terms`.**
   Wording-only fixes (typo, formatting) can ship without a bump. Anything
   that changes a participant's rights or obligations bumps the constant
   in the same commit; the Phase 3 booking flow will then require explicit
   re-acceptance on the next submission. There is no manual "publish a new
   terms version" admin step.
2. **Liability-cap copy.** Section 8's "limited to the booking amount you
   paid through EventKart for that event" is the current V1 stance. If
   business ever offers a higher cap (e.g. paid insurance add-on),
   coordinate the Terms edit with the booking-flow disclosure copy and
   bump the version.
3. **Refund framework.** If a platform-default refund policy is ever
   introduced (vs the current per-event organizer-defined model), section
   5 needs to change first and the per-event "policy text in force at
   booking time" column logic needs to keep working for legacy bookings.
4. **Governing law.** Section 10 is bare ("laws of India") because the
   pilot is single-jurisdiction. If EventKart ever lists outside India,
   add a jurisdiction/choice-of-forum clause.
5. **Dispute escalation.** The escalation path (organizer first → support
   email at `/contact`) is wired to mailto today. Once I-7.2.5 ships the
   public dispute reporting form, update the `<Link to="/contact">`
   sentence in section 5 to refer participants to the form rather than
   email.
