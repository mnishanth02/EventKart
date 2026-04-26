# I-1.2.3: Pricing Configuration

**Feature ID:** I-1.2.3
**Module:** 1.2 — Event Creation & Management
**Status:** ✅ Complete (2026-04-26)
**Dependencies:** I-1.2.2 — Event category & distance configuration
**Downstream:** I-2.1.4 category pricing display, I-3.1.1 category selection, I-3.2.10 capacity reservation/booking pricing

## Scope

Configure per-category pricing for draft events, including base price in integer paise and optional early-bird pricing with a deadline.

## Acceptance Criteria

1. Shared constants and Zod schemas define integer-paise pricing bounds, early-bird price/deadline pairing, early-bird price lower than base price, duplicate tier rejection, and persisted pricing tier response shapes.
2. Database schema includes `event_pricing_tiers` with one tier per event category, integer price checks, early-bird pairing checks, and migration/rollback coverage.
3. API exposes public `GET /api/v1/events/:eventId/pricing` and organizer-only `PUT /api/v1/events/:eventId/pricing`.
4. PUT replaces tiers transactionally and validates auth, CSRF, ownership, draft status, configured categories, unknown category IDs, missing category tiers, duplicate tiers, and request body shape.
5. Server-side pricing helper validates event/category match and current timestamp before returning the applicable base or early-bird price.
6. Web exposes server functions, query options, `/org/events/$eventId/configure-pricing`, and a pricing form with validation, mutation, and query invalidation.

## Implementation Tasks

| #   | Task                             | File(s)                                                                                  | Status        |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| 1   | Shared constants and schemas     | `packages/shared/src/constants/event.ts`, `packages/shared/src/schemas/event-pricing.ts` | ✅ 2026-04-26 |
| 2   | Database table and migration     | `packages/db/src/schema/event-pricing-tiers.ts`, `packages/db/drizzle/0010_*`            | ✅ 2026-04-26 |
| 3   | API route schemas and service    | `apps/api/src/modules/events/{schemas,routes,service}.ts`                                | ✅ 2026-04-26 |
| 4   | Applicable price helper          | `apps/api/src/modules/events/service.ts`                                                 | ✅ 2026-04-26 |
| 5   | API route/service tests          | `apps/api/test/modules/events/{routes,service}.test.ts`                                  | ✅ 2026-04-26 |
| 6   | Web server functions and queries | `apps/web/src/features/events/{api,api.server,queries,types}.ts`                         | ✅ 2026-04-26 |
| 7   | Web pricing configuration UI     | `apps/web/src/features/events/components/event-pricing-config-form.tsx`                  | ✅ 2026-04-26 |
| 8   | Organizer pricing route          | `apps/web/src/routes/_authed/org/events/$eventId/configure-pricing.tsx`                  | ✅ 2026-04-26 |
| 9   | Integrated validation/review     | Shared, DB, API, web targeted checks                                                     | ✅ 2026-04-26 |

## Validation Evidence

- `pnpm --filter @repo/shared exec vitest run test\schemas\event-pricing.test.ts` — 10 tests passed.
- `pnpm --filter @repo/db exec vitest run test\schema.test.ts` — 13 tests passed.
- `pnpm --filter @repo/db db:check:rollbacks` — rollback files present and non-empty.
- `pnpm --filter api exec vitest run test\modules\events\routes.test.ts test\modules\events\service.test.ts` — 94 tests passed.
- `pnpm --filter web exec vitest run src\features\events\api.server.test.ts src\features\events\components\event-pricing-config-form.test.tsx` — 17 tests passed.
- `pnpm --filter web check-types` — passed.

## Known Baseline Notes

- `pnpm --filter api check-types` still has unrelated pre-existing failures in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`.
