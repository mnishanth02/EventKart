# I-2.5.4 — `/about` page (positioning, mission, Coimbatore pilot)

**Module:** 2.5 (Public Chrome & Legal Pages)
**Feature ID:** I-2.5.4
**Source row:** `docs/v1-implementation-plan.md` Module 2.5 row 3 (file row 547)
**Status:** ✅ Complete

---

## 1. Scope

Ship a SSR, CDN-cacheable `/about` page at
`apps/web/src/routes/_public/about.tsx` (~165 LOC). Unlike `/privacy` and
`/terms`, this is a **positioning page, not a legal document** — no
version, no `effectiveDate`, no participant consent stamp.
`LegalPageLayout` is reused for the chrome (typography, container width)
but the version metadata line is intentionally suppressed (props are not
passed).

Six sections:

1. **Our mission** — two paragraphs, sourced verbatim from
   `docs/product-plan.md` §1 (organizer mission + participant mission).
2. **What EventKart is** — positioning paragraphs (organizer operating
   system; unifies registration + payment + participant management +
   event-day check-in vs generic ticketing tools).
3. **Who we serve** — Organizers (small-to-mid Indian fitness event
   organizers, 1–10 events/month, 50–2000 participants/event, currently
   stitching Forms/Razorpay/WhatsApp/Excel) and Participants (end users of
   the booking flow, long-term retention layer).
4. **The Coimbatore pilot** — paraphrased from product-plan §10: density
   target (a handful of organizers + 10+ events in the first two months
   → 15+ active organizers + 30+ events by month six); the
   trust-before-territory expansion bar (15+ active organizers, 3+ having
   run 3+ events on EventKart, conversion improvement vs old
   Forms-plus-payment-link flow, split payout operations stable).
5. **From the team** — generic team blurb with a `TODO` for ops to
   personalize once leadership chooses the voice. We explicitly did NOT
   invent a founder name. Closes with a typed `<Link to="/contact">` for
   readers to reach out.
6. **What EventKart is not** — verbatim from product-plan: not a wedding /
   concert / entertainment ticketing platform, not a generic all-events
   marketplace, not travel/hotel, not GPS/workout logging, not enterprise
   white-label, not a full social fitness network in V1.

The route component splits into `AboutPage` (route binding) and an exported
`AboutContent` for direct unit testing without a router shell, mirroring
the rest of Module 2.5.

## 2. Decisions / rationale

### Not a versioned document — `LegalPageLayout` props omitted

`/about` is positioning, not policy. Passing `version` / `effectiveDate`
to `LegalPageLayout` would render a misleading "Version X · Effective …"
metadata line under the H1, which would imply this page binds participant
consent. The layout's "render the metadata line only when both props are
passed" guard means the page renders without it cleanly.

### Mission paragraphs are verbatim from product-plan §1

The two mission paragraphs (organizer + participant) are copied verbatim,
not paraphrased. This is deliberate — `docs/product-plan.md` is the
single source of truth for product positioning, and the public About page
is the most visible surface where positioning either matches or drifts.
Paraphrasing creates drift; verbatim makes drift impossible.

### Coimbatore-pilot story is paraphrased, not verbatim

§10 of product-plan covers expansion criteria as an internal-facing
roadmap. The About page paraphrases the same numbers (15+ active
organizers, 3+ having run 3+ events, conversion improvement, split-payout
stability) into reader-friendly prose. If product-plan §10 changes the
numbers, this paragraph needs the matching edit — this is a known
maintenance cost we accepted for narrative quality.

### "What EventKart is not" is verbatim

Six bullet points copied from product-plan. Same reason as the mission
paragraphs: these are guardrail statements that constrain product scope,
and any drift between the public page and the internal product plan would
be hard to spot.

### "From the team" stays generic with an explicit TODO

The blurb says "we kept seeing the same gap in Indian fitness events" and
ends with a `<Link to="/contact">`. There is no founder name, no quote,
no headshot. A `TODO` comment immediately above the paragraph instructs
ops to replace it with a personalized founder note once leadership chooses
the voice. Inventing a name would be irresponsible; shipping nothing
would leave the page missing an obvious section.

### Cross-page link uses typed `<Link>`

`<Link to="/contact">` is a typed TanStack Router link, not an `<a href>`
fallback. Tests mock `@tanstack/react-router` so the `<Link>` renders as
`<a href={to}>` without needing a `RouterProvider` — the same pattern
used by every other Module 2.5 page test.

### Module 2.5 shared infra

Cache headers (`LEGAL_PAGE_CACHE_CONTROL` — 1h fresh / 24h SWR), SEO
helper (`buildLegalPageHead`), and `LegalPageLayout` are imported from
`apps/web/src/features/legal-pages/`. See I-2.5.1 for the full
shared-infra rationale.

## 3. Verification

- **Page tests:** 7 colocated tests in
  `apps/web/src/routes/_public/about.test.tsx` covering the mission
  paragraphs, the "What EventKart is" positioning, the Coimbatore pilot
  paragraphs, the "What EventKart is not" bullet list, the "From the
  team" cross-page link to `/contact`, and the absence of a version /
  effective-date metadata line.
- `pnpm --filter @repo/shared check-types` ✓
- `pnpm --filter @repo/shared test` ✓ — 197/197.
- `pnpm --filter web check-types` ✓
- `pnpm --filter web lint` ✓ (Biome clean)
- `pnpm --filter web test` ✓ — 649/649.

## 4. Future-proofing notes

1. **Edit product-plan and About together.** Whenever
   `docs/product-plan.md` §1, §10, or the "What EventKart is not" list
   changes, edit this page in the same commit. The verbatim-vs-paraphrase
   split is documented in section 2 above so reviewers can spot drift.
2. **Replacing the "From the team" blurb.** Find the `TODO` comment in
   `about.tsx` — replace the paragraph and remove the TODO. If a
   founder photo is added, add it as a sibling block above the
   paragraph; do not embed it inside the `prose` typography wrapper.
3. **City expansion.** When the pilot expands beyond Coimbatore, the
   "Coimbatore pilot" section becomes "Our pilot cities" or similar; the
   density-target paragraph still names Coimbatore as the original
   benchmark and adds a paragraph for the new city's bar. The
   trust-before-territory paragraph stays.
4. **Adding a Press / Investors / Careers page.** These are siblings of
   `/about`, not children. They get their own routes (`/press`,
   `/investors`, `/careers`) and their own impl-plan entries. The
   `LegalPageLayout` chrome is reusable; the SEO helper is reusable.
5. **Internationalization.** When `hreflang` gains additional locales
   (today only `en` + `x-default`), this page is the most translation-
   sensitive of Module 2.5 because it carries the most narrative copy.
