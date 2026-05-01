# I-2.3.5 — Organizer slug generation

> Reverse-traced closeout — all functional work shipped in Phase 2 Readiness Sprint W1.1 (2026-04-29). This document records the as-built design and the new unit tests added in 2026-04-30.

## Summary

This feature provides unique, URL-safe organizer slugs (`organizers.slug`, NOT NULL, unique) and a `slug_redirects` row on every businessName-driven rename so historical organizer URLs keep resolving (powering the future I-2.4.6 301 handler). Implementation was delivered as a side effect of Phase 2 Readiness Sprint W1.1 on 2026-04-29 to unblock I-2.1.2 (the organizer card on `/events/:slug` needed a stable `/organizers/:slug` link target). Round-2 hardening in v2.4 (same date) added the `NOT NULL` invariant, switched the migration backfill to `unaccent` (mirroring the shared TS slug kernel), expanded the reserved-slug list, and made businessName regeneration + redirect writes a single transaction. This closeout adds (1) focused unit tests for `slug-service.ts` so the public contract is locked at the function boundary, and (2) formal source-of-truth tracking for the feature.

## Source-of-truth references

- `docs/v1-implementation-plan.md:507` — Module 2.3 row 1 (I-2.3.5 acceptance criteria)
- `docs/v1-implementation-plan.md:1853` — v2.3 changelog (Phase 2 Readiness Sprint W1.1 implementation)
- `docs/v1-implementation-plan.md:1854` — v2.4 changelog (round-2 hardening: NOT NULL, `unaccent` normalization, expanded reserved list, transactional businessName regeneration)
- `progress.md:50` — Phase 2 Readiness W1.1 entry (initial implementation)
- `progress.md:57` — Phase 2 Readiness fix-loop entry (round-2 hardening)
- `packages/db/drizzle/0015_organizers_slug.sql` — migration (ADD COLUMN → backfill → NOT NULL → unique index)
- `packages/db/drizzle/rollbacks/0015_organizers_slug.rollback.sql` — paired rollback

## Acceptance criteria mapping

| Criterion                                                                                 | Implementation                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizers.slug` column with NOT NULL + unique index                                     | `packages/db/drizzle/0015_organizers_slug.sql` (line 1 ADD COLUMN, line 51 SET NOT NULL, line 52 unique index); `packages/db/src/schema/organizers.ts`                                                                             |
| Deterministic, URL-safe slug normalization (NFKD + unaccent)                              | `packages/shared/src/utils/slug.ts` (`normalizeSlug`); migration `0015` DO block (lines 5–50) mirrors the TS kernel via `unaccent` + `regexp_replace`                                                                              |
| Reserved-slug enforcement                                                                 | `packages/shared/src/constants/organizer.ts` (`RESERVED_ORGANIZER_SLUGS`, ~26 entries); `apps/api/src/modules/organizer/slug-service.ts` (`isReservedOrganizerSlug` line 33, skipped inside `reserveUniqueOrganizerSlug` line 114) |
| Uniqueness check across active organizers AND historical redirects                        | `apps/api/src/modules/organizer/slug-service.ts` (`organizerSlugExists` lines 48–86 queries both `organizers` and `slug_redirects`)                                                                                                |
| Slug generation on organizer create                                                       | `apps/api/src/modules/organizer/service.ts` (`registerOrganizer`, `reserveUniqueOrganizerSlug` call at line 101)                                                                                                                   |
| Slug regeneration + `slug_redirects` write on businessName change in a single transaction | `apps/api/src/modules/organizer/service.ts` (`updateOrganizer`, transaction lines 221–270); `apps/api/src/modules/organizer/slug-service.ts` (`recordOrganizerSlugRedirect` lines 135–179, `renameOrganizerSlug` lines 185–225)    |
| `slug_redirects` table powers the I-2.4.6 301 handler                                     | `packages/db/src/schema/slug-redirects.ts`; table created in I-1.2.10 (migration `0007_known_lucky_pierre.sql`)                                                                                                                    |

## Files (as-built inventory)

- `packages/shared/src/constants/organizer.ts` — `ORGANIZER_SLUG_*` constants and `RESERVED_ORGANIZER_SLUGS` (~26 entries; mirrored verbatim in the migration's hard-coded reserved list)
- `packages/shared/src/utils/slug.ts` — `normalizeSlug` and `appendSlugSuffix` generic helpers shared with event slugs
- `packages/db/src/schema/organizers.ts` — `slug` column on the `organizers` table
- `packages/db/src/schema/slug-redirects.ts` — `slug_redirects` table + indexes (created in I-1.2.10)
- `packages/db/drizzle/0015_organizers_slug.sql` — adds `slug` column, backfills via deterministic `unaccent` normalization, sets NOT NULL, creates unique index
- `packages/db/drizzle/rollbacks/0015_organizers_slug.rollback.sql` — paired rollback
- `apps/api/src/modules/organizer/slug-service.ts` — public API: `reserveUniqueOrganizerSlug`, `generateUniqueOrganizerSlug`, `recordOrganizerSlugRedirect`, `renameOrganizerSlug`, `isReservedOrganizerSlug`, `ORGANIZER_SLUG_RESOURCE_TYPE`
- `apps/api/src/modules/organizer/service.ts` — calls the slug service in `registerOrganizer` (line 101) and `updateOrganizer` (transaction at lines 221–270)

## Test coverage

### Existing (pre-2026-04-30)

- `apps/api/test/modules/organizer/service.test.ts` — 4 cases for `updateOrganizer` covering: businessName → slug regeneration + redirect in one transaction; no-op when regenerated slug is unchanged; suffix on concurrent collision; transaction rollback when redirect insert fails (so slug change is not committed separately).
- `apps/api/test/modules/organizer/registration.test.ts` — uses the `slug` field in registration response assertions.
- `apps/api/test/modules/organizer/profile-update.test.ts` — uses the `slug` field in profile-update response assertions.
- `packages/shared/test/constants/organizer.test.ts` — 1 case validating the reserved-slug list shape.

### Added by I-2.3.5 closeout (2026-04-30)

- `apps/api/test/modules/organizer/slug-service.test.ts` — focused unit tests for every exported function in `slug-service.ts` (`isReservedOrganizerSlug`, `reserveUniqueOrganizerSlug`, `generateUniqueOrganizerSlug`, `recordOrganizerSlugRedirect`, `renameOrganizerSlug`, `ORGANIZER_SLUG_RESOURCE_TYPE`), locking in the public contract so future refactors of `updateOrganizer` cannot silently drift the slug API. Authored by sibling todo `slug-service-unit-tests`.

## Validation

The orchestrator (the user-facing primary agent) will execute these commands and fill in the pass counts below:

```shell
pnpm --filter api check-types
pnpm --filter api exec vitest run test/modules/organizer/slug-service.test.ts
pnpm --filter @repo/shared check-types
pnpm --filter @repo/shared test
pnpm --filter @repo/db check-types
pnpm --filter @repo/db test
pnpm --filter @repo/db db:check:rollbacks
```

Results: _<orchestrator: paste pass/fail counts here after running>_

## Risks / follow-ups

- I-2.3.1 (organizer profile page) consumes `organizers.slug` for the `/organizers/:slug` SSR route — unblocked by this work.
- I-2.4.6 (301 redirect handler) consumes `slug_redirects` rows — unblocked by this work.
- Future organizer renames at scale: the redirect-set lookup is bounded only by the reserved-list filter and `maxAttempts` (default 50). No additional rate-limiting was added — acceptable for V1; revisit if real-world rename frequency or adversarial slug-squatting becomes a concern.

## Decisions

- **D1** — I-2.3.5 ships as a trace/closeout doc rather than a fresh implementation slice because all functional work was delivered upfront in Phase 2 Readiness Sprint W1.1 to unblock I-2.1.2's organizer-card link to `/organizers/:slug`. Re-implementing would duplicate W1.1 and risk regressions in the migration, the reserved-list, or the transactional rename path.
- **D2** — Dedicated unit tests for `slug-service.ts` were added in this closeout (rather than relying on the integration coverage in `service.test.ts`) so the public contract is locked at the function boundary and survives future refactors of `updateOrganizer` or any new caller of `reserveUniqueOrganizerSlug` / `renameOrganizerSlug`.

## Tasks

| Task                                                                     | Status                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Document the as-built implementation (this file)                         | ✅ Complete (2026-04-30)                                          |
| Add focused unit tests for `slug-service.ts`                             | ✅ Complete (2026-04-30) — sibling todo `slug-service-unit-tests` |
| Update `docs/v1-implementation-plan.md` row 507 (I-2.3.5) to ✅ Complete | ⏳ Pending — orchestrator                                         |
| Add I-2.3.5 row to `progress.md`                                         | ⏳ Pending — orchestrator                                         |
| Archive this plan to `docs/archived/` once tracking is updated           | ⏳ Pending — follow-up sweep                                      |
