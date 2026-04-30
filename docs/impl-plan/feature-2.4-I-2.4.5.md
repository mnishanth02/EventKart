# I-2.4.5 — `robots.txt` + crawl directives

**Module:** 2.4 (CDN, Caching, SEO Infrastructure)
**Feature ID:** I-2.4.5
**Source row:** `docs/v1-implementation-plan.md` Module 2.4 row 5
**Status:** ✅ Complete

---

## 1. Scope

Replace the placeholder `apps/web/public/robots.txt` (which permitted unrestricted crawling of the entire app) with explicit allow/disallow directives that match the EventKart route plan.

This file is shipped as a static asset under `apps/web/public/`. Vite + Nitro
(via `@tanstack/react-start/plugin/vite` + `nitro/vite`) serve every file in
`public/` from the site root, so a request to `https://eventkart.in/robots.txt`
returns this exact file contents — no SSR route is required (and grepping
`apps/web/src/routes` confirms no route handler currently overrides
`/robots.txt`).

## 2. Directives chosen (and rationale)

| Directive       | Path           | Why                                                                                                                              |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Allow: /`      | root           | Discovery / homepage (SSR + CDN-cached, SEO-relevant — see I-2.4.1, I-2.1.x)                                                     |
| `Allow: /events/`     | `/events/*`    | Event detail pages — primary SEO surface (I-2.1.1 … I-2.1.10, JSON-LD I-2.1.6)                                              |
| `Allow: /organizers/` | `/organizers/*`| Organizer public profiles (I-2.3.1 … I-2.3.6) — second SEO surface                                                          |
| `Allow: /privacy`     | `/privacy`     | Legal page (Module 2.5; required for ad networks, app stores, payment processor due-diligence)                              |
| `Allow: /terms`       | `/terms`       | Legal page (Module 2.5)                                                                                                     |
| `Allow: /contact`     | `/contact`     | Contact + public dispute form (I-2.5.3)                                                                                     |
| `Allow: /about`       | `/about`       | About page (Module 2.5)                                                                                                     |
| `Allow: /faq`         | `/faq`         | Participant FAQ (I-2.5.5)                                                                                                   |
| `Disallow: /org$` + `Disallow: /org/`     | `/org`, `/org/*`     | Organizer dashboard — auth-only, `ssr: 'data-only'`. See "Prefix-match subtlety" below. |
| `Disallow: /admin$` + `Disallow: /admin/` | `/admin`, `/admin/*` | Admin console — auth-only, sensitive surface, must not appear in search                  |
| `Disallow: /my$` + `Disallow: /my/`       | `/my`, `/my/*`       | Per-user dashboard — auth-only, personalized                                              |
| `Disallow: /book$` + `Disallow: /book/`   | `/book`, `/book/*`   | Booking flow — transactional, requires session + reservation                              |
| `Disallow: /api$` + `Disallow: /api/`     | `/api`, `/api/*`     | Web app's server-function endpoints (TanStack Start `createServerFn` routes); the Fastify backend is on a different origin (`api.eventkart.app`) and is unaffected by this file. Defense-in-depth in case the Fastify origin's robots is misconfigured. |

These match the row in `docs/v1-implementation-plan.md` Module 2.4 verbatim.

### Prefix-match subtlety (RFC 9309)

Robots.txt path matching is **prefix-based** per
[RFC 9309 §2.2.2](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2).
That means:

- `Disallow: /org/` blocks `/org/dashboard` ✓ but does **not** block `/org`
  (no trailing slash, so it's a different URL prefix).
- `Disallow: /org` (no anchor, no trailing slash) would block `/org` *and*
  `/organizers/...` — the latter is an SEO-critical surface we explicitly
  want indexed (I-2.3.x).

To block the bare URL exactly while keeping `/organizers/` crawlable, we use
the `$` end-of-line anchor (a Google/Bing/Yandex extension; see
[Google robots.txt spec](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt#url-matching-based-on-path-values)).
RFC 9309 mandates that crawlers ignore unsupported tokens, so non-supporting
crawlers degrade gracefully — they treat `/org$` as a literal prefix that
never matches a real URL, leaving the bare path unblocked for them. That is
acceptable: the exposed routes redirect to login when accessed
unauthenticated, so the worst case is an empty/redirect page being indexed
by a long-tail crawler. Major search engines all support `$`.

The bare URLs for `/admin`, `/my`, `/org` exist as concrete TanStack routes
(`apps/web/src/routes/_authed/{admin,my,org}.tsx` with `index.tsx` children).
`/book` and `/api` do not currently expose a bare route, but the `$`-anchored
disallow is included for symmetry and to defend against future additions.

## 3. `Sitemap:` URL — build-time vs request-time decision

**Decision:** the `Sitemap:` URL is hard-coded to the canonical production
origin: `https://eventkart.in/sitemap.xml`.

**Why not dynamic from `VITE_SITE_URL`?**

`apps/web/public/robots.txt` is a *static* asset. Vite copies it into the build
output verbatim — there is no SSR/build-time substitution layer applied to
files in `public/`. Two ways we could have made it dynamic:

1. **Move to an SSR route** (`apps/web/src/routes/robots.txt.ts`) that reads
   `publicEnv.VITE_SITE_URL` and emits the body. Trade-off: every request hits
   the origin (no edge cache without an extra cache header), couples a trivial
   text file to the React/TanStack runtime, and adds a route to maintain.
2. **Add a Vite build plugin** that template-substitutes `${VITE_SITE_URL}`
   into the file at build time. Trade-off: invents a new build mechanism for
   one file; the env var is captured at build time anyway, so a static file
   with the canonical URL is functionally identical for the production build.

For V1, the production origin is fixed at `https://eventkart.in`. Crawler
discovery of the sitemap is improved (not blocked) by this directive, and
Google Search Console / Bing Webmaster will be configured to point at the
canonical sitemap URL directly (I-2.4.4). The cost of being wrong is low —
crawlers ignore unreachable `Sitemap:` URLs gracefully.

**For non-production environments** (preview branches, staging, a future
`.com`/`.app` rename, self-hosted clones): this file must be edited or
substituted at deploy time. The simplest options, in order of preference:

- Use a CDN/Cloudflare Page Rule or Worker to rewrite `/robots.txt` → an empty
  `User-agent: *\nDisallow: /` for non-production hostnames so preview/staging
  isn't indexed under any domain.
- Override the file via a build-time copy step that swaps in a different
  `Sitemap:` line per environment.
- If the production origin permanently changes, edit this file and move the
  decision rationale to the new origin.

## 4. Verification (this PR)

- `apps/web/src/lib/robots.test.ts` reads the file from disk via `node:fs` and
  asserts every required `Allow:` / `Disallow:` line plus the `Sitemap:`
  directive are present. Co-located with other lib-level tests
  (`api-client.test.ts`, `health.test.ts`).
- `pnpm --filter web check-types` — passes.
- `pnpm --filter web test` — full suite passes.

## 5. Future-proofing notes

1. **When the sitemap URL changes** (rename of the origin, or a switch from
   `eventkart.in` → another TLD): update the `Sitemap:` line *and* the
   canonical-URL helpers in `features/event-detail/seo.ts` and
   `features/organizer-detail/seo.ts` together — they must agree, or
   crawlers will down-rank the inconsistency.
2. **When Module 2.5 lands new public legal pages** (e.g. `/refunds`,
   `/cookies`, `/accessibility`): add an explicit `Allow:` line here AND a
   matching assertion in `robots.test.ts`. The default behavior of a
   `User-agent: *` block with a leading `Allow: /` is to allow everything not
   explicitly disallowed, so the new page would be crawlable without any
   change — but listing it explicitly keeps `robots.txt` readable as the
   single source of truth for intentional public surfaces.
3. **When adding a new auth-only top-level route** (e.g. `/settings`,
   `/billing`): add a `Disallow: /<segment>/` line and a matching assertion in
   the test. Forgetting this is a privacy footgun.
4. **If we ever serve the booking flow on a public landing page** (e.g.
   `/events/<slug>/book`): the current `Disallow: /book/` only matches the
   top-level `/book/*` namespace and would not block a nested URL. Re-evaluate
   then.
5. **If `/api/` semantics change** (e.g. server functions move to `/_server/`
   or similar): update the disallow line. Crawlers POSTing/GETing server
   function endpoints is harmless but wasteful.
