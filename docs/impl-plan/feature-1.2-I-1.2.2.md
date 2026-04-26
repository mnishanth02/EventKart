# I-1.2.2: Event Category & Distance Configuration

**Feature ID:** I-1.2.2
**Module:** 1.2 — Event Creation & Management
**Status:** ✅ Complete (2026-04-26)
**Dependencies:** I-1.2.1 — Event creation form
**Downstream:** I-1.2.3 pricing configuration, I-2.1.1 public event page, I-3.1.1 category selection

## Scope

Configure running-event distance categories for draft events, starting with V1 defaults for 5K, 10K, and Half Marathon.

## Acceptance Criteria

1. Shared constants and Zod schemas define category names, slugs, distance meters, sort order, duplicate validation, and V1 default category configuration.
2. Database schema includes `event_categories` with per-event uniqueness for slug, name, and sort order plus a migration and rollback.
3. API exposes `GET /api/v1/events/:eventId/categories` publicly and `PUT /api/v1/events/:eventId/categories` for organizer-owned draft events only.
4. PUT replaces categories transactionally and validates auth, CSRF, ownership, draft status, and request body shape.
5. Web exposes server functions and `/org/events/$eventId/configure-categories` with a dynamic category form, query invalidation, and creation redirect from `/org/events/new`.

## Implementation Tasks

| #   | Task                             | File(s)                                                                                   | Status        |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------- | ------------- |
| 1   | Shared constants and schemas     | `packages/shared/src/constants/event.ts`, `packages/shared/src/schemas/event-category.ts` | ✅ 2026-04-26 |
| 2   | Database table and migration     | `packages/db/src/schema/event-categories.ts`, `packages/db/drizzle/0009_*`                | ✅ 2026-04-26 |
| 3   | API route schemas and service    | `apps/api/src/modules/events/{schemas,routes,service}.ts`                                 | ✅ 2026-04-26 |
| 4   | API route/service tests          | `apps/api/test/modules/events/{routes,service}.test.ts`                                   | ✅ 2026-04-26 |
| 5   | Web server functions and queries | `apps/web/src/features/events/{api,api.server,queries}.ts`                                | ✅ 2026-04-26 |
| 6   | Web category configuration UI    | `apps/web/src/features/events/components/event-category-config-form.tsx`                  | ✅ 2026-04-26 |
| 7   | Organizer route and redirect     | `apps/web/src/routes/_authed/org/events/$eventId/configure-categories.tsx`                | ✅ 2026-04-26 |
| 8   | Web tests                        | `apps/web/src/features/events/**/*.test.ts*`                                              | ✅ 2026-04-26 |
| 9   | Integrated validation/review     | Shared, DB, API, web targeted checks                                                      | ✅ 2026-04-26 |

## Validation Evidence

- `pnpm --filter @repo/shared exec vitest run test/schemas/event-category.test.ts` — 12 tests passed.
- `pnpm --filter @repo/db exec vitest run test/schema.test.ts` — 12 tests passed.
- `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts` — 47 tests passed.
- `pnpm --filter web exec vitest run src/features/events/api.server.test.ts src/features/events/components/event-category-config-form.test.tsx` — 9 tests passed.
- `pnpm --filter web check-types` — passed.

## Known Baseline Notes

- Full API check-types still has unrelated pre-existing failures in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`.
- Full web lint/check remains affected by an unchanged pre-existing import-order issue in `form-values.test.ts`.
