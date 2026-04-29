# I-1.2.4: Registration Form Field Configuration

**Feature ID:** I-1.2.4  
**Module:** 1.2 — Event Creation & Management  
**Status:** ✅ Complete (2026-04-28)  
**Landed in:** `6dbed2b` (foundation), `631cacc` (API), `77e28ff` (web UI)  
**Dependencies:** I-1.2.1 — Event creation form  
**Downstream:** I-3.1.2 — Participant registration form; I-5.1.5/I-5.3.3 — sensitive-field suppression and safety-critical handling

## Scope

Allow organizers to configure the participant registration fields collected for an event, including standard identity/contact fields and fitness-specific fields such as blood group, T-shirt size, emergency contact, and medical information. The implementation stores the configured schema on the event, validates it through shared contracts, exposes organizer-owned draft-event API endpoints, and provides the organizer configuration UI.

## Completed Layers

| Layer                | Completed implementation                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Database             | Added `form_schema` JSONB and `form_schema_version` columns on `events`, with migration and rollback coverage.                                                                                                                                         |
| Shared               | Added registration form constants/catalog, default schema, Zod validation, exports, and focused schema tests.                                                                                                                                          |
| API                  | Added organizer-scoped `GET/PUT /api/v1/events/:eventId/registration-form` handling with ownership, draft-event mutation rules, validation, and persistence.                                                                                           |
| Web                  | Added server functions, query options, configuration route `/org/events/$eventId/configure-registration-fields`, form UI, navigation from existing event configuration surfaces, and focused component coverage for sensitive-field reason validation. |
| Documentation/status | Marked I-1.2.4 complete in `progress.md` and `docs/v1-implementation-plan.md`; updated dependent I-1.2.6/I-1.2.8 notes.                                                                                                                                |

## Validation Evidence

| Evidence source                                   | Coverage                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `6dbed2b Add registration form foundation`        | Commit adds DB migration/rollback, schema consistency checks, shared registration form catalog/schema, and `packages/shared/test/schemas/event-registration-form.test.ts`.                              |
| `631cacc Add event registration form API`         | Commit adds API route/service support plus focused `apps/api/test/modules/events/routes.test.ts` and `apps/api/test/modules/events/service.test.ts` coverage for organizer-scoped get/update behavior.  |
| `77e28ff Add registration field configuration UI` | Commit adds web API wiring, route registration, configuration UI, and `event-registration-field-config-form.test.tsx` coverage for organizer field configuration and sensitive-field reason validation. |
| Current docs pass                                 | This implementation record and status updates are docs-only; no source changes were made during the documentation closeout.                                                                             |

## Publish-Gating Follow-up

I-1.2.4 now provides `form_schema` and `form_schema_version`, but the I-1.2.6 publish-readiness checklist still does not include a registration-form-schema readiness item. Keep that as a product/implementation follow-up if publishing should require explicit organizer review of the default registration form before participants can book.
