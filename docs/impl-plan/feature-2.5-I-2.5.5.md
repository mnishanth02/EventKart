# I-2.5.5 — `/faq` page (FAQPage JSON-LD + Accordion)

**Module:** 2.5 (Public Chrome & Legal Pages)
**Feature ID:** I-2.5.5
**Source row:** `docs/v1-implementation-plan.md` Module 2.5 row 4 (file row 548)
**Status:** ✅ Complete

---

## 1. Scope

Ship a SSR, CDN-cacheable `/faq` page at
`apps/web/src/routes/_public/faq.tsx` (~250 LOC) covering the five
participant-facing questions called out on row 548:

1. `how-booking-works` — browse without signing in, OTP at submission, UPI
   or card via the payment gateway, email confirmation + QR ticket on
   payment success.
2. `view-past-booking` — confirmation email contains a direct link;
   booking-by-phone-plus-reference lookup ships in Phase 3 (`TODO(I-3.3.8)`
   marker on the placeholder paragraph); meanwhile, email
   `SUPPORT_EMAIL`.
3. `refund-process` — per-event policy as captured at booking time;
   organizer first, then EventKart support; SLA =
   `SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS` business days; cross-link
   to `/terms`.
4. `event-day` — show QR at organizer's check-in; sensitive fields visible
   only to event-day staff on offline rosters; 30-day post-event removal
   unless legally required to retain.
5. `data-safe` — DPDPA-aware posture (data minimization, purpose
   limitation, explicit consent at booking submission); sensitive fields
   are opt-in by default; cross-link to `/privacy`.

The page renders with shadcn/ui `<Accordion type="multiple">` from
`@repo/ui/components/ui/accordion` (verified present at component-placement
audit time), with `defaultValue={items.map((item) => item.id)}` so every
item is pre-expanded and the SSR-emitted DOM matches the post-hydration
state for a stable hydration pass. Each accordion item carries a
deterministic `value` taken from `FAQ_ITEMS[i].id`.

The same `FAQ_ITEMS` const drives both the rendered Q&A list and the
Schema.org `FAQPage` JSON-LD `mainEntity`. The route exports both
`FAQ_ITEMS` and `buildFaqPageJsonLd(items?)` so tests can assert structural
equivalence without re-deriving the JSON-LD by hand.

## 2. Decisions / rationale

### Parallel `answer: ReactNode` + `plainTextAnswer: string` per item

Each `FaqItem` carries two answer fields:

- `answer: ReactNode` — the JSX rendered into the Accordion. May contain
  `<a href={mailto}>`, typed `<Link>`, multiple `<p>` blocks.
- `plainTextAnswer: string` — the plain-text version embedded in JSON-LD
  `acceptedAnswer.text`.

This is deliberate. Google's FAQPage spec
(<https://developers.google.com/search/docs/appearance/structured-data/faqpage>)
requires the answer text in JSON-LD to be plain text (no HTML, no JSX).
Trying to derive the plain-text version from the JSX subtree is fragile —
any change to the JSX (a `<strong>`, a typed `<Link>`, a list item) would
silently change the JSON-LD output. Carrying both fields side-by-side and
documenting "when editing copy, edit BOTH fields" via a doc comment on
`FaqItem` makes drift loud (a copy reviewer notices the two fields
disagree) instead of silent.

### `Accordion type="multiple"` with all items pre-expanded

`type="multiple"` keeps every item independently expandable so the
SSR-rendered DOM matches the client `data-state="open"` for a stable
hydration pass. This avoids the hydration-mismatch class of bugs that
`type="single"` + `defaultValue={undefined}` would create on a route that
emits the entire answer list in HTML for SEO.

It also keeps the page usable when JS is disabled — Radix's accordion
remains keyboard-operable post-hydration, and pre-expanded items mean
no-JS readers see all answers without needing to click.

The route-file doc comment notes that the native `<details>` element is
the recommended swap-in if the shadcn `Accordion` primitive ever goes
away — every item already carries a stable `id` value that maps to a
`<details id={...}>` rendering with no other code change.

### JSON-LD reuses the `event-detail/json-ld.ts` escape boundary

`buildFaqPageJsonLd()` is a pure function (no env reads, no `Date.now()`)
so the cached HTML stays byte-stable and is compatible with the legal-page
CDN cache contract (1h `s-maxage`, 24h SWR).

The returned object is passed through `serializeJsonLdForInlineScript<T>`
from `apps/web/src/features/event-detail/json-ld.ts` — the same generic
helper that the Event JSON-LD (I-2.1.6) and BreadcrumbList JSON-LD
(I-2.4.8) use to escape `&`, `<`, `>`, U+2028, and U+2029 before embedding
in an inline `<script type="application/ld+json">`. A future `</script>`
sequence in any answer (or an LSEP/PSEP sneaking in via copy-paste from
Word) cannot break out of the script tag.

The script is added via TanStack Start's `head().scripts` pipeline so the
`<script>` element is hoisted into `<head>` (Google accepts FAQPage
JSON-LD in either `<head>` or `<body>`, but `<head>` is conventional).

### `FaqPageView({ items })` split for unit testing

The route `component` is a thin `FaqRouteComponent` that calls
`<FaqPageView items={FAQ_ITEMS} />`. Tests render `FaqPageView` directly
with the canonical items (or a single-item subset) without booting
`RouterProvider`, mirroring the `RegisterPlaceholder` /
`ContactContent` / `AboutContent` / `TermsContent` splits used by every
other Module 2.5 route.

### `not-prose` Accordion + `prose` answer body

The `Accordion` itself is wrapped with `className="not-prose mt-6 w-full"`
so `LegalPageLayout`'s `prose` typography rules do not over-style Radix's
trigger/content chrome. Each `AccordionContent` then re-opens a
`<div className="prose prose-neutral max-w-none dark:prose-invert">` so
the answer body still gets typography styles applied.

### `view-past-booking` carries a `TODO(I-3.3.8)`

The second answer paragraph for "How do I view a past booking?" is the
mailto fallback; the `TODO(I-3.3.8)` comment marks it for removal once
the booking-lookup-by-phone flow ships in Phase 3.

### Module 2.5 shared infra

Cache headers (`LEGAL_PAGE_CACHE_CONTROL` — 1h fresh / 24h SWR), SEO
helper (`buildLegalPageHead`), `LegalPageLayout`, `SUPPORT_EMAIL`, and
`SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS` are imported from
`apps/web/src/features/legal-pages/`. See I-2.5.1 for the full
shared-infra rationale.

## 3. Verification

- **Page tests:** 9 colocated tests in
  `apps/web/src/routes/_public/faq.test.tsx` covering all five rendered
  questions, all five answer bodies, the typed `<Link to="/contact">` /
  `<Link to="/terms">` / `<Link to="/privacy">` cross-page links, the
  `mailto:` to `SUPPORT_EMAIL`, the JSON-LD shape (`@type: "FAQPage"`,
  `mainEntity` length 5, every `Question.name` matches `FAQ_ITEMS[i].question`,
  every `Answer.text` matches `plainTextAnswer`), and the
  `serializeJsonLdForInlineScript` escape boundary (asserts no raw
  `</script>` in the serialized payload).
- `pnpm --filter @repo/shared check-types` ✓
- `pnpm --filter @repo/shared test` ✓ — 197/197.
- `pnpm --filter web check-types` ✓
- `pnpm --filter web lint` ✓ (Biome clean)
- `pnpm --filter web test` ✓ — 649/649.

## 4. Future-proofing notes

1. **Adding a new FAQ.** Append to `FAQ_ITEMS` with a unique `id`, a JSX
   `answer`, and a parallel `plainTextAnswer`. The Accordion picks it up
   automatically (every item is pre-expanded by `defaultValue`), the
   JSON-LD `mainEntity` array grows by one, and the existing tests'
   length assertion catches any forgotten test update.
2. **Editing an answer.** Edit BOTH `answer` (JSX) and `plainTextAnswer`
   (plain string). The doc comment on `FaqItem` says so and the JSON-LD
   shape test asserts they match. Skipping the plain-text update silently
   ships a stale snippet to Google's SERP.
3. **`view-past-booking` swap (I-3.3.8).** Replace the `TODO(I-3.3.8)`
   paragraph with a typed `<Link>` to the new lookup page once Phase 3
   lands. Keep the email fallback as the second sentence — it remains
   useful for participants who lost both the email and access to the
   phone they booked with.
4. **If shadcn `Accordion` is ever replaced.** Every item carries a
   stable `id` value. Swap to `<details id={item.id}><summary>{item.question}</summary>...</details>`
   and drop the `defaultValue` prop. The JSON-LD pipeline is unaffected.
5. **CDN cache + JSON-LD freshness.** `LEGAL_PAGE_CACHE_CONTROL` is 1h
   `s-maxage` / 24h SWR. A FAQ copy edit takes up to 1h to propagate at
   the edge unless purged manually. This is acceptable for documentation
   copy and is the same trade-off documented in I-2.5.1.
