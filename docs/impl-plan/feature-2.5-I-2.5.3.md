# I-2.5.3 — `/contact` page (email + phone fallback; dispute form deferred)

**Module:** 2.5 (Public Chrome & Legal Pages)
**Feature ID:** I-2.5.3
**Source row:** `docs/v1-implementation-plan.md` Module 2.5 row 5 (file row 549)
**Status:** ✅ Complete

---

## 1. Scope

Ship a SSR, CDN-cacheable `/contact` page at
`apps/web/src/routes/_public/contact.tsx` (~156 LOC) that satisfies the V1
sequencing rule on row 549 of the v1-implementation-plan: the
contact-email/phone fallback ships in Phase 2, and the embedded public
dispute reporting form is added in Phase 7 by I-7.2.5 (which itself depends
on this page existing). Phase 2 launch is therefore **not** blocked on the
dispute form being ready.

Surfaces today:

- Card-wrapped email block with a `mailto:` to `SUPPORT_EMAIL`.
- Conditional phone block: when `getSupportPhone()` returns a value, a
  `tel:` link plus an "available during Indian business hours, Monday to
  Friday, IST" line; when it returns `null`, a "phone support is coming
  soon" line. The PublicFooter remains email-only either way.
- Response time SLA: `SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS = 2`
  business days, mentioned in both the lede and the dedicated section, and
  cross-referenced from the FAQ page (I-2.5.5).
- "What to include in your request" checklist (booking reference, event
  name + date, short description, contact phone if different).
- "Reporting an issue with an organizer" — escalation path mirrors the
  Terms (I-2.5.2) §5 framework: organizer first, then EventKart support.
- A `TODO(I-7.2.5)` comment marks the exact mount point for the Phase 7
  dispute form, plus a small placeholder paragraph ("A public dispute
  reporting form will be added to this page soon.") so the section is
  visible to users today.

The route component splits into `ContactPage` (route binding, reads loader
data) and an exported `ContactContent({ supportPhone })` so unit tests can
render the body directly with mock `supportPhone` values without booting
`RouterProvider` or stubbing `publicEnv`.

## 2. Decisions / rationale

### Loader resolves the support phone server-side

`getSupportPhone()` runs inside `loader` and the result is forwarded
through `useLoaderData()`. Two reasons:

1. SSR markup stays deterministic — the React tree never reads `publicEnv`
   at render time, so HTML emitted by the edge cache cannot drift between
   "phone available" and "coming soon" depending on which edge POP served
   the request.
2. Tests can render `ContactContent` with a fixed `supportPhone` prop and
   assert both branches without monkey-patching env state.

### Phone block is `null`-conditional, not feature-flagged

`VITE_PUBLIC_SUPPORT_PHONE` is an optional Zod `string().optional()` env
var. Absent or empty → `getSupportPhone()` returns `null` → the page
renders the "coming soon" line. This is intentionally simpler than a
boolean feature flag: the flag is the env value itself, and there is no
"flag on but no number" failure mode.

### `tel:` link strips whitespace defensively

`telHref = supportPhone !== null ? `tel:${supportPhone.replace(/\s+/g, "")}` : null`
— iOS / Android dialers accept spaces, but the `tel:` URI scheme is
specified without them and stripping eliminates a class of edge-case
copy/paste bugs from the env value.

### Dispute form is a TODO, not a stub component

Row 549 explicitly says the dispute form is owned by I-7.2.5 (Phase 7) and
that Phase 2 must not block on it. The cheapest correct thing is a
single-line placeholder paragraph plus a `TODO(I-7.2.5)` comment marking
the mount point — no stubbed form component, no half-implemented schema.
When I-7.2.5 lands, it replaces the placeholder.

### Card wrapper opts out of `prose` typography

The email block sits inside a `<Card>` wrapped in `<div className="not-prose my-8">`
so the shared `LegalPageLayout`'s `prose` rules do not over-style the
card's own typography. The phone heading and "what to include" list are
back inside `prose`. This is the same pattern used by the FAQ page (I-2.5.5)
where the Accordion is `not-prose` but the answer body is `prose`.

### Module 2.5 shared infra

Cache headers (`LEGAL_PAGE_CACHE_CONTROL` — 1h fresh / 24h SWR), SEO
helper (`buildLegalPageHead`), `LegalPageLayout`, `SUPPORT_EMAIL`,
`SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS`, and `getSupportPhone()` are
imported from `apps/web/src/features/legal-pages/`. The
`VITE_PUBLIC_SUPPORT_PHONE` env var is a new optional addition to
`apps/web/src/lib/env/public.ts`. See I-2.5.1 for the full shared-infra
rationale; the constants and the env var live there because they are
shared with the FAQ page (`SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS`) and
the future I-7.2.5 dispute form (will reuse the same `SUPPORT_EMAIL`).

## 3. Verification

- **Page tests:** 8 colocated tests in
  `apps/web/src/routes/_public/contact.test.tsx` covering both phone-block
  branches (number present + `null`), the `mailto:` to `SUPPORT_EMAIL`,
  the SLA line, the cross-page `<Link to="/terms">`, the
  `TODO(I-7.2.5)` placeholder paragraph, and the `tel:` whitespace
  stripping.
- `pnpm --filter @repo/shared check-types` ✓
- `pnpm --filter @repo/shared test` ✓ — 197/197.
- `pnpm --filter web check-types` ✓
- `pnpm --filter web lint` ✓ (Biome clean)
- `pnpm --filter web test` ✓ — 649/649.

## 4. Future-proofing notes

1. **I-7.2.5 dispute form mount.** Find the `TODO(I-7.2.5)` comment in
   `contact.tsx` — that paragraph + the placeholder text below it are the
   exact swap-point. Replace with the form component; keep the rest of the
   page (email, phone, SLA, "what to include", "reporting an issue with an
   organizer") above the form so users with simple support questions never
   have to scroll past a long form.
2. **Turning on phone support.** Set `VITE_PUBLIC_SUPPORT_PHONE` in
   `.env.local` / production. No code change needed. The PublicFooter
   intentionally remains email-only — if business wants the phone in the
   footer too, the constant in `apps/web/src/features/legal-pages/constants.ts`
   is the source of truth and the footer can opt in by importing
   `getSupportPhone` the same way this page does.
3. **SLA change.** `SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS` lives in
   `apps/web/src/features/legal-pages/constants.ts` and is referenced in
   three places (this page's lede + dedicated section, and the FAQ
   refund-process answer). One edit propagates to all surfaces.
4. **Multi-channel support (chat, in-app form).** The current page is
   structured around two channels (email, phone). When a third lands, add
   it as a sibling block above "Response time" rather than replacing the
   email card — email should stay the documented escalation path because
   it leaves an auditable trail for dispute timelines.
5. **City-specific phone number.** If pilot expansion adds a Bangalore
   number alongside Coimbatore, the constant becomes a map and the page
   renders both. The `null` fallback shape generalizes cleanly.
