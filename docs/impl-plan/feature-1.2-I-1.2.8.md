# I-1.2.8: Event Edit & Update Capabilities

**Feature ID:** I-1.2.8  
**Module:** 1.2 — Event Creation & Management  
**Status:** ✅ Complete (2026-04-27)  
**Dependencies:** I-1.2.1 — Event creation form; I-1.2.2 — Event category & distance configuration; I-1.2.3 — Pricing configuration; I-1.2.4 — Registration form field configuration; I-1.2.5 — Refund & cancellation policy capture; I-1.2.9 — Event image upload  
**Downstream:** I-1.2.6 — Event publish workflow; I-2.1.1 — Public event page layout; I-2.4.2 — CDN cache invalidation

## Scope

Allow organizers to edit pre-event draft event details after creation, while preserving ownership checks, draft-only mutation rules, slug redirect behavior, and navigation into the existing configuration surfaces for categories, pricing, policies, form fields, and images.

## Acceptance Criteria

1. Shared constants and Zod schemas define the full editable core event update payload, reject empty/unknown fields, preserve immutable fields, and expose persisted event response shapes for edit forms.
2. API exposes `GET /api/v1/events/:eventId` for core event detail and organizer-only `PUT /api/v1/events/:eventId` for draft event updates.
3. PUT validates auth, CSRF, organizer ownership, draft status, request body shape, and transactional persistence of core event changes.
4. Title/slug-affecting updates reuse the I-1.2.10 slug service so unchanged slugs are no-ops, changed slugs record redirects, and historical slug redirects keep resolving to the current event.
5. API and shared tests cover valid updates, empty payloads, invalid fields, unauthorized/forbidden requests, non-draft rejection, slug changes, and slug no-ops.
6. Web exposes server functions, query options, and `/org/events/$eventId/edit` with a prefilled organizer edit form, mutation handling, cache invalidation, success/error states, and links to existing configuration routes.
7. CDN invalidation is documented as a follow-up/design seam unless a Cloudflare purge integration exists; this feature must not claim CDN purge behavior as implemented without that integration.

## Implementation Tasks

| #   | Task                                   | File(s)                                                                                     | Status                                         |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Shared update schemas and types        | `packages/shared/src/schemas/event.ts`, `packages/shared/test/schemas/event.test.ts`        | ✅ Complete (2026-04-27)                       |
| 2   | API schemas/routes/service             | `apps/api/src/modules/events/{schemas,routes,service}.ts`                                   | ✅ Complete (2026-04-27)                       |
| 3   | Slug redirect handling on update       | `apps/api/src/modules/events/service.ts`                                                    | ✅ Complete (2026-04-27)                       |
| 4   | API route/service tests                | `apps/api/test/modules/events/{routes,service}.test.ts`                                     | ✅ Complete (2026-04-27)                       |
| 5   | Web server functions, queries, types   | `apps/web/src/features/events/{api,api.server,queries,types}.ts`                            | ✅ Complete (2026-04-27)                       |
| 6   | Organizer edit form UI                 | `apps/web/src/features/events/components/event-edit-form.tsx`                               | ✅ Complete (2026-04-27)                       |
| 7   | Organizer edit route and navigation    | `apps/web/src/routes/_authed/org/events/$eventId/edit.tsx`, existing event configuration UI | ✅ Complete (2026-04-27)                       |
| 8   | Web tests                              | `apps/web/src/features/events/**/*edit*.test.ts*`                                           | ✅ Complete (2026-04-27)                       |
| 9   | CDN invalidation design seam/follow-up | API/web update flow documentation and future I-2.4.2 integration point                      | ✅ Complete (documented follow-up, 2026-04-27) |
| 10  | Integrated validation/review           | Shared, API, and web targeted checks plus lint/check-types                                  | ✅ Complete (2026-04-27)                       |

## Validation Evidence

- `pnpm --filter @repo/shared test` — passed (13 files, 157 tests).
- `pnpm --filter @repo/shared check-types` — passed.
- `pnpm --filter api exec vitest run test/modules/events/routes.test.ts test/modules/events/service.test.ts` — passed (2 files, 131 tests).
- `pnpm --filter web check-types` — passed.
- `pnpm --filter web test` — passed.
- `pnpm --filter web lint` — passed.
- `pnpm --filter @repo/shared lint` — passed.
- `pnpm --filter api lint` — completed with pre-existing warnings in admin/auth/organizer files outside I-1.2.8 changes.
- `pnpm --filter api check-types` — still fails on pre-existing unrelated audit/auth test strictness issues in `test/lib/audit.test.ts` and `test/modules/auth/otp-verify.test.ts`.

## Baseline / Design Notes

- I-1.2.10 already provides the slug generation and redirect-recording foundation; I-1.2.8 should reuse that service rather than introducing a second slug workflow.
- I-1.2.8 depends on all editable event surfaces existing. If I-1.2.4 or I-1.2.5 is still incomplete when implementation begins, keep those sections linked to their configuration routes instead of duplicating unfinished fields in the edit form.
- Repository search found Cloudflare architecture and roadmap references, but no current Cloudflare API purge/invalidation integration. Treat CDN purge as a documented follow-up for I-2.4.2 until that integration exists.
- Edits are pre-event and draft-only for V1; publish/admin review workflows remain separate downstream features.
