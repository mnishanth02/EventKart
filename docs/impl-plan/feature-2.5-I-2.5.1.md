# I-2.5.1 — `/privacy` page (DPDPA-aware privacy notice)

**Module:** 2.5 (Public Chrome & Legal Pages)
**Feature ID:** I-2.5.1
**Source row:** `docs/v1-implementation-plan.md` Module 2.5 row 1 (file row 545)
**Status:** ✅ Complete

---

## 1. Scope

Ship a SSR, CDN-cacheable `/privacy` page at
`apps/web/src/routes/_public/privacy.tsx` (~259 LOC) covering the participant
data-handling story EventKart V1 commits to. The page is treated as a
versioned legal document so the booking-time `consent_records.consent_version`
stamp (Phase 3) and the displayed copy stay in lockstep.

Content is sourced verbatim or paraphrased from `docs/product-plan.md` §13
("Privacy and Data Handling") and `docs/requirements.md` §4 ("Trust, Privacy,
and Data Handling Requirements") — no legal claims are invented in the page
body. Eight numbered sections are rendered inside the shared
`LegalPageLayout`:

1. Data we collect — 4-row table (participant profile, booking data, sensitive
   fields, payment data) with examples, access scope, and retention.
2. How we use your data — minimization, opt-in sensitive fields, consent at
   collection, scoped organizer access, separate KYC storage, deletion rights,
   DPDPA posture.
3. Retention windows — plain-language summary of the table.
4. Your rights — access / correction / deletion / withdraw consent, plus a
   "How to exercise your rights" subsection with a `mailto:` link to
   `SUPPORT_EMAIL` and a `TODO(I-7.3.8)` marker for the eventual DSAR
   self-service flow.
5. Consent — explicit, no pre-checked boxes, version recorded with booking.
6. Event-day handling — offline rosters, sensitive-field gating, QR check-in
   minimal-display posture.
7. Data security and incidents — prevention-first posture and CERT-In /
   regulator notification commitment.
8. Contact — `SUPPORT_EMAIL` mailto plus typed `<Link>` to `/terms` and
   `/contact`.

The displayed `Version` label is wired to `PARTICIPANT_LEGAL_VERSIONS.privacy`
(see "Module 2.5 shared infra" below) so a version bump in
`@repo/shared/constants` is the single change that re-anchors the page label,
the booking-time `consent_records.consent_version` value, and any future
re-consent prompt.

## 2. Decisions / rationale

### Single source of truth for the participant legal version

The displayed `version` and `effectiveDate` (`2026-05-01`) are not free-form
strings. The version is read from `PARTICIPANT_LEGAL_VERSIONS.privacy` in
`@repo/shared/constants`, the same constant the Phase 3 booking flow will
import when stamping `consent_records.consent_version` for the
`booking_terms` and `data_usage` document families. The doc comment on the
route file requires `effectiveDate` to be edited in the same change set as a
version bump.

This is deliberately separate from the existing
`packages/shared/src/constants/policy.ts` `CURRENT_POLICY_VERSIONS`, which is
the **organizer-facing** policy version. Keeping participant + organizer
versioning independent means an organizer policy bump cannot trigger
participant re-consent, and a privacy/terms bump cannot invalidate
organizer-side acceptance state. Two version tracks, two consent surfaces.

### DSAR contact stays a `mailto:` for V1

Section 4 ("Your rights") routes data-subject requests to `SUPPORT_EMAIL` via
a prefilled-subject mailto. A `TODO(I-7.3.8)` comment marks the exact
paragraph that gets replaced once the dedicated DSAR self-service flow ships
in Phase 7. Shipping the mailto today is what unblocks the DPDPA-aware
disclosure obligation without coupling Module 2.5 to a Phase 7 deliverable.

### Sensitive-fields posture is opt-in by default

Section 2 explicitly names "Sensitive fields are opt-in by default" (medical
conditions, blood group). This wording is what the booking-form schema and
event-day roster export will be checked against — a future Phase 3 change
that flips a sensitive field to required without an organizer-supplied
safety reason violates this published policy.

### Retention windows are fixed numbers, not ranges

Profile = 3-year inactivity OR account deletion. Booking + payment = 5 years
(financial / audit). Sensitive event-day fields = 30 days post-event unless
legally required. Fixed numbers (not "approximately X") are what
`workers/cleanup.ts` will be implemented against.

### Module 2.5 shared infra (also referenced by I-2.5.2 / I-2.5.3 / I-2.5.4 /
### I-2.5.5)

The five Module 2.5 routes share a small set of helpers under
`apps/web/src/features/legal-pages/`:

- `cache-headers.ts` — exports `LEGAL_PAGE_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"`
  and an isomorphic `setLegalPageCacheHeaders(headers)` (no-op on the
  client, calls TanStack Start `setHeaders` on the server). The 1h-fresh /
  24h-SWR window is intentionally longer than the 60s/300s used on
  `/events/*` and `/organizers/*` (I-2.1.1, I-2.3.1) because legal copy is
  revision-controlled in source — origin-pull churn would be wasted work
  and a wording correction is handled either by a manual CDN purge or by
  natural 1h `s-maxage` expiry.
- `seo.ts` — `buildLegalCanonicalUrl({ siteUrl?, path })` and
  `buildLegalPageHead({ title, description, path, siteUrl? })` mirror the
  patterns from `features/event-detail/seo.ts` and
  `features/organizer-detail/seo.ts`. Emits title, description,
  og:title/og:description/og:url/og:type=`website`, twitter:card=`summary`,
  canonical link, and `hreflang en` + `hreflang x-default` (gated together
  on canonical resolving to an absolute URL — same pattern as I-2.4.7).
  Local lightweight `HeadMetaEntry` / `HeadLinkEntry` types so this folder
  stays uncoupled from `event-detail/seo.ts`.
- `constants.ts` — `SUPPORT_EMAIL = "support@eventkart.run"` (matches the
  existing PublicFooter mailto), `getSupportPhone(): string | null`
  reading optional `publicEnv.VITE_PUBLIC_SUPPORT_PHONE`,
  `SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS = 2`.
- `components/legal-page-layout.tsx` — `<LegalPageLayout>` wrapping
  children in `<article class="prose prose-neutral dark:prose-invert max-w-none">`
  using the already-installed `@tailwindcss/typography` plugin. Optional
  `version` + `effectiveDate` props render the metadata line under the H1
  only when **both** are passed (so `/about`, `/contact`, `/faq` render
  without a version line).
- `apps/web/src/lib/env/public.ts` gains an optional
  `VITE_PUBLIC_SUPPORT_PHONE` (Zod `string().optional()`).

`@repo/shared/constants/legal-pages.ts` exports
`PARTICIPANT_LEGAL_DOC_IDS = ["privacy", "terms"] as const`,
`PARTICIPANT_LEGAL_VERSIONS = { privacy: "1.0", terms: "1.0" } as const`,
and the `ParticipantLegalDocId` union, re-exported via
`packages/shared/src/constants/index.ts`. Five new tests in
`legal-pages.test.ts` cover the exported shape.

## 3. Verification

- **Page tests:** 4 colocated tests in
  `apps/web/src/routes/_public/privacy.test.tsx` covering rendered headings,
  the data-class table, the DSAR mailto, and cross-page typed `<Link>`
  targets.
- **Shared infra tests:** colocated tests for `cache-headers`, `seo`, and
  `legal-page-layout`; 5 new tests in
  `packages/shared/src/constants/legal-pages.test.ts`.
- `pnpm --filter @repo/shared check-types` ✓
- `pnpm --filter @repo/shared test` ✓ — 197/197 (+5 from `legal-pages.test.ts`).
- `pnpm --filter web check-types` ✓
- `pnpm --filter web lint` ✓ (Biome clean)
- `pnpm --filter web test` ✓ — 649/649 (+93 across the 5 page tests, footer
  test, and feature-folder tests).

## 4. Future-proofing notes

1. **Bumping `PARTICIPANT_LEGAL_VERSIONS.privacy`.** The constant is the
   single switch. When you bump it, also (a) update `effectiveDate` on this
   route in the same change set, (b) update the Phase 3 booking flow's
   re-consent gate, and (c) confirm no unit test in
   `legal-pages.test.ts` is asserting a hard-coded string.
2. **DSAR self-service (I-7.3.8).** Section 4's mailto paragraph is the
   exact swap-point — find the `TODO(I-7.3.8)` comment in `privacy.tsx`.
3. **Adding a new participant-facing legal document.** Add the new id to
   `PARTICIPANT_LEGAL_DOC_IDS` and its initial version to
   `PARTICIPANT_LEGAL_VERSIONS` in the same commit. The booking flow's
   consent recorder will fail-closed if the constant lacks a version for an
   id it tries to stamp.
4. **CDN purge on a wording correction.** The `LEGAL_PAGE_CACHE_CONTROL`
   contract is `s-maxage=3600`. A real-world correction either waits up to
   1h or triggers a manual Cloudflare purge for `/privacy`. Both are
   acceptable for a copy fix; for a legally-mandated immediate change,
   purge is required.
5. **Retention numbers.** If `workers/cleanup.ts` ever needs to deviate
   from the 30-day sensitive-field expiry, edit this page first — the
   policy text is the contract and the cleanup job is the implementation.
