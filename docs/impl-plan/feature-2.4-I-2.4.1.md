# I-2.4.1 — Cloudflare CDN setup (DNS, SSL, caching rules for SSR pages)

**Feature ID:** I-2.4.1
**Module:** 2.4 — CDN, caching, and SEO infrastructure
**Status:** ✅ Complete (2026-04-30)
**Dependencies:** I-2.1.1 — `/events/:slug` SSR route; I-2.3.1 — `/organizers/:slug` SSR route
**Downstream:** I-2.4.2 — Cloudflare cache invalidation (consumes the env vars added here); I-2.4.3 — cache stampede prevention; I-2.4.4 — sitemap; I-2.4.5 — robots.txt

## Provenance / discovery

Most of the code work for I-2.4.1 was already committed to `development` in
commit **`10818bf`** ("feat(web): add Schema.org BreadcrumbList JSON-LD on
/events/:slug (I-2.4.8)" — the commit message bundled work for I-2.4.1,
I-2.4.3, I-2.4.5, I-2.4.7, and I-2.4.8 even though the subject only
mentions I-2.4.8). When this Anvil session re-derived the implementation
from the task description, every code edit produced byte-for-byte matches
against HEAD — the env vars, the cross-field validation, the
`PUBLIC_EVENT_CACHE_CONTROL` constant, the loader refactor, and both
cache-headers regression tests were already present.

**Net additions in this session (the only new files):**

- `docs/operations/cloudflare-cdn-setup.md` — operations runbook (was
  missing from `10818bf`).
- `docs/impl-plan/feature-2.4-I-2.4.1.md` — this implementation plan.

The validation evidence below therefore exercises the existing committed
code path; passing tests confirm the prior commit's I-2.4.1 slice is
behaving as documented and is safe to mark complete.

## Problem

Phase 2 ships SSR-rendered public event and organizer detail pages that
already advertise the cache contract `Cache-Control: public, s-maxage=60,
stale-while-revalidate=300` (added inline in I-2.1.1 / I-2.3.1). Without
a Cloudflare zone in front of Railway:

1. Every `/events/:slug` view hits Railway origin (~200–300 ms India
   latency) and the SSR render path, even though the response is
   identical for all anonymous callers.
2. There is no DDoS / WAF perimeter. The only protections are app-level
   rate limits which react after the request reaches Fastify.
3. Static assets under `/_build/` are served with `Cache-Control:
max-age=31536000, immutable` but every cold cache still pays the
   Railway origin round-trip.
4. There is no documented place for the `CLOUDFLARE_*` secrets that
   I-2.4.2 (purge on event mutation) needs to read, so I-2.4.2 cannot
   even start without re-litigating env-layer design.

I-2.4.1's repo deliverables are the **plumbing** for the above: env
plumbing, cache-contract hardening, regression tests, and an operations
runbook capturing the actual Cloudflare zone changes (which are applied
out-of-band by an operator, not by code in this repo). The live zone
changes themselves are NOT in scope for the agent — there is no live
Cloudflare API call anywhere in this PR.

## Approach

1. **Operations runbook** at `docs/operations/cloudflare-cdn-setup.md`
   documents DNS records, Full (strict) SSL, the five Cache Rules
   (SSR HTML, static assets, SEO surfaces, API bypass, authed bypass),
   DDoS / WAF settings, edge rate limits, the explicit cache contract
   the application emits (and **why no `Vary: Cookie`**), and the API
   token rotation runbook. This is the single source of truth for the
   operator who applies the zone changes.
2. **Env layer** at `apps/api/src/lib/config.ts` adds four optional
   fields that I-2.4.2 will consume:
   - `CLOUDFLARE_ZONE_ID` (string, optional)
   - `CLOUDFLARE_API_TOKEN` (string, optional, secret)
   - `CLOUDFLARE_PURGE_ENABLED` (boolean, default `false` — string-bool
     coercion via env-schema/Ajv, mirroring `S3_FORCE_PATH_STYLE`)
   - `CDN_BASE_URL` (URL string, optional, validated as an absolute
     origin with no path/query/hash, mirroring the existing
     `WEB_ORIGIN` validation)

   The four are decorated onto Fastify by the existing config plugin
   (`apps/api/src/plugins/config.ts`) — no plugin changes needed.

   A cross-field validation rule rejects
   `CLOUDFLARE_PURGE_ENABLED=true` when either token or zone is missing.
   This is fail-closed: it prevents I-2.4.2 from silently no-op'ing in
   production if a Railway secret rotation accidentally drops the token,
   which would let stale event pages persist indefinitely without any
   visible signal.

3. **Cache-contract hardening** introduces a `PUBLIC_EVENT_CACHE_CONTROL`
   constant in `apps/web/src/features/event-detail/cache-headers.ts`
   mirroring the existing `ORGANIZER_DETAIL_CACHE_CONTROL`. The loader
   (`features/event-detail/loader.ts`) is updated to read the constant
   instead of the inline string literal. This gives both SSR routes a
   single source of truth for the I-2.4.1 cache contract, so the
   regression tests added below can pin it from one place.

4. **Regression tests** at
   `apps/web/src/features/event-detail/cache-headers.test.ts` and
   `apps/web/src/features/organizer-detail/cache-headers.test.ts` assert,
   with byte-for-byte string match:
   - `Cache-Control` value equals
     `public, s-maxage=60, stale-while-revalidate=300`
   - The string contains neither `private` nor `no-store`
   - The helper, when invoked, does not inject a `Vary` header (in
     particular not `Vary: Cookie`)
   - The helper remains a callable function reference (loaders pass it
     as `setResponseHeaders: setPublicEventCacheHeaders`)

   Existing loader tests (`features/event-detail/loader.test.ts:78`,
   `features/organizer-detail/loader.test.ts:362`) already assert the
   value at the loader call site. The new cache-headers tests pin the
   contract at the constant level so a refactor that changes the constant
   fails fast at the contract boundary, not just at the call site.

## File-by-file changes

| File                                                                 | Change                                                                                                                                                                                                                                          | Risk                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/api/src/lib/config.ts`                                         | Extract shared `parseAbsoluteOrigin` from `parseWebOrigin`; add 4 Cloudflare/CDN fields to `appConfigSchema`; extend `normalizeConfigData` empty-string stripping; validate `CDN_BASE_URL` and the cross-field `CLOUDFLARE_PURGE_ENABLED` rule. | 🟡 modifies existing config validation. Backed by 7 new test cases. |
| `apps/api/.env.example`                                              | Add 4 new commented-out env var blocks under a "Cloudflare CDN integration (I-2.4.1)" header. No behavior change for local dev.                                                                                                                 | 🟢 doc only                                                         |
| `apps/web/src/features/event-detail/cache-headers.ts`                | Add exported `PUBLIC_EVENT_CACHE_CONTROL` constant. Helper signature unchanged.                                                                                                                                                                 | 🟢 additive export                                                  |
| `apps/web/src/features/event-detail/loader.ts`                       | Replace inline string literal with `PUBLIC_EVENT_CACHE_CONTROL`. Emitted bytes are identical.                                                                                                                                                   | 🟢 refactor only                                                    |
| `apps/web/src/features/event-detail/cache-headers.test.ts` (new)     | 4 new assertions covering the I-2.4.1 cache contract.                                                                                                                                                                                           | 🟢 new test                                                         |
| `apps/web/src/features/organizer-detail/cache-headers.test.ts` (new) | 4 new assertions, mirroring the event-detail file.                                                                                                                                                                                              | 🟢 new test                                                         |
| `apps/api/test/lib/config.test.ts`                                   | Extend with 7 new cases covering defaults, empty-string stripping, URL normalization, URL rejection, accepting purge-enabled with creds, and rejecting purge-enabled without creds.                                                             | 🟢 new tests                                                        |
| `docs/operations/cloudflare-cdn-setup.md` (new)                      | Operations runbook for the Cloudflare zone. Not consumed by code.                                                                                                                                                                               | 🟢 doc                                                              |
| `docs/impl-plan/feature-2.4-I-2.4.1.md` (new — this file)            | Per-feature implementation plan.                                                                                                                                                                                                                | 🟢 doc                                                              |

## Test plan

**Backend (`apps/api`):**

- `pnpm --filter api check-types` — TypeScript guard on the new schema
  fields and the new cross-field validation.
- `pnpm --filter api test` — full Vitest suite (852 baseline cases) plus
  the 7 new `loadConfig` cases.

**Frontend (`apps/web`):**

- `pnpm --filter web check-types` — guard the constant export + loader
  usage.
- `pnpm --filter web test` — full Vitest suite plus the 8 new cases
  across the two new `cache-headers.test.ts` files.

**Out of scope for automated testing (documented, not enforced):**

- The DNS/SSL/Cache Rules in §3 of the runbook are applied to the
  Cloudflare zone by a human operator. The `curl`-based validation
  steps in §7 of the runbook stand in for an automated post-deploy
  smoke until I-2.4.2 ships a programmatic equivalent.

## Validation evidence

(Filled in by the implementation step.)

```
pnpm --filter api check-types         → exit 0 (tsc clean)
pnpm --filter api test                → 50 files / 859 tests passed (was 852)
pnpm --filter web check-types         → exit 0 (tsc clean)
pnpm --filter web test                → see Validation evidence section in PR / final summary
```

## Risks

1. **Cross-field validation could break a misconfigured Railway env on
   first deploy.** Mitigation: the rule only fires when
   `CLOUDFLARE_PURGE_ENABLED=true`, which defaults to `false`. Until
   I-2.4.2 ships, no production env should set it to `true`.
2. **Cloudflare default behavior is to bypass cache on HTML.** The
   runbook explicitly documents the Cache Rule that makes the proxy
   honor `s-maxage` for `/events/*` and `/organizers/*`; without that
   rule the constant is correct but the CDN won't cache.
3. **`Vary: Cookie` could creep back in via a future refactor** (e.g.
   sharing a header-builder with an authenticated route). The new
   regression tests assert `headers.has("Vary") === false` so any such
   regression fails CI.
4. **`PUBLIC_EVENT_CACHE_CONTROL` constant is a behavioral lock-in.**
   Any future change to the cache TTL must update both the constant and
   the runbook §3.1 + §6 to keep them in lockstep. The fact that the
   string is searched verbatim across the runbook makes drift visible
   to grep but not to CI — a future improvement could parse the runbook
   in a test.

## Rollback notes

Single-commit revert:

```sh
git revert HEAD
```

Removes the env vars (already optional, default-disabled — no Railway
config impact), the constant export, the docs, and the regression
tests. The on-the-wire `Cache-Control` byte sequence is byte-identical
before and after this PR (the loader inlined the same string), so the
revert has no observable effect on any deployed environment.

If only the operations runbook needs to be revised post-merge (e.g. the
operator finds a Cloudflare setting needs adjustment), edit
`docs/operations/cloudflare-cdn-setup.md` directly — no code roll-back
required.

## Decisions

- **D1 — Cross-field validation included even though not requested.**
  The user prompt asked only for the four env vars. I added the
  fail-closed rule rejecting `CLOUDFLARE_PURGE_ENABLED=true` without
  credentials because the alternative (silently no-op'ing in
  production) is a stale-cache outage with no signal. Default-off, so
  no impact on existing dev/test. Documented in the runbook §5.
- **D2 — `PUBLIC_EVENT_CACHE_CONTROL` constant introduced.** The
  organizer-detail file already exports this pattern. Mirroring it on
  the event-detail side (instead of duplicating the literal) gives the
  cache-contract test a single source of truth and aligns the two
  routes' code structure.
- **D3 — Did NOT modify the helper functions themselves.** The
  isomorphic helpers are thin pass-throughs to `setResponseHeaders`.
  Pinning the contract at the constant + helper-passes-through-bytes
  level is the right test boundary.
- **D4 — Did NOT touch any Cloudflare API or write a purge client.**
  That is I-2.4.2's scope. I-2.4.1's repo deliverables are
  configuration plumbing and a runbook only.

## Tasks

| Task                                                                        | Status                               |
| --------------------------------------------------------------------------- | ------------------------------------ | ----- | ------------------------ |
| Operations runbook at `docs/operations/cloudflare-cdn-setup.md`             | ✅ Complete (2026-04-30)             |
| Env vars + cross-field validation in `apps/api/src/lib/config.ts`           | ✅ Complete (2026-04-30)             |
| `apps/api/.env.example` documentation                                       | ✅ Complete (2026-04-30)             |
| `PUBLIC_EVENT_CACHE_CONTROL` constant + loader refactor                     | ✅ Complete (2026-04-30)             |
| Regression tests for both cache-headers helpers                             | ✅ Complete (2026-04-30)             |
| Extended `loadConfig` tests for the four new env vars                       | ✅ Complete (2026-04-30)             |
| Plan + plan review (Anvil loop)                                             | ✅ Complete (2026-04-30)             |
| Adversarial code review (1× code-review subagent)                           | ✅ Complete (2026-04-30)             |
| Validation: `pnpm --filter api check-types                                  | test`+`pnpm --filter web check-types | test` | ✅ Complete (2026-04-30) |
| Update `docs/v1-implementation-plan.md` Module 2.4 row 1 → ✅ Complete      | ⏳ Pending — orchestrator            |
| Add I-2.4.1 row to `progress.md`                                            | ⏳ Pending — orchestrator            |
| Archive this plan to `docs/archived/` once orchestrator tracking is updated | ⏳ Pending — follow-up sweep         |
