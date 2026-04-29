# Implementation Plan: I-1.2.7 — Admin Event Review Interface

## Scope

**Feature ID:** I-1.2.7  
**Module:** 1.2 — Event Creation & Management  
**Status:** ✅ Complete (2026-04-27)  
**Task size:** Large  
**Risk classification:** Red (`admin`, `public-api`, publish workflow)

## Acceptance Criteria

1. Paid events from organizers with fewer than 3 previously published paid events are submitted to `under_review` at publish time.
2. Admins can list event reviews at `/api/v1/admin/event-reviews` and `/admin/event-reviews`.
3. Admins can inspect review details before approving or rejecting.
4. Admin approve moves `under_review → published`; admin reject moves `under_review → draft`.
5. Approval/rejection requires admin auth and writes audit log entries. Rejection reason is audit-only unless a storage field already exists.
6. Focused API/web validation covers the new review path without broadening unrelated dirty work.

## Design

- Reuse the existing event publish state machine helpers from `apps\api\src\modules\events\service.ts`.
- Keep event-review API under the existing admin module as `/api/v1/admin/event-reviews`.
- Add shared Zod contracts in `packages\shared\src\schemas\admin-event-review.ts`.
- Add web server functions and components to the existing `apps\web\src\features\admin` feature.
- Do not add database migrations; rejection reason is written to audit metadata only.

## Tasks

| Task                                   | Status | Notes                                                        |
| -------------------------------------- | ------ | ------------------------------------------------------------ |
| Shared admin event-review contracts    | ✅     | List/detail/action schemas added.                            |
| Publish-time first-3 paid event policy | ✅     | Counts previously `published` paid events for the organizer. |
| Admin event-review API                 | ✅     | List/detail/approve/reject endpoints added with admin RBAC.  |
| Admin event-review UI                  | ✅     | Queue/detail pages added under `/admin/event-reviews`.       |
| Tests                                  | ✅     | Focused API service/route and web component tests added.     |
| Progress docs                          | ✅     | `progress.md`, v1 plan, and this active plan updated.        |

## Validation

Record exact command results in the final Anvil evidence bundle.

## Rollback

Revert the I-1.2.7 files changed in this slice. No database rollback is required because no migration is introduced.
