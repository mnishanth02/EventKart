# Feature: Organizer Self-Service Account Deletion

<!-- markdownlint-disable MD028 MD029 -->

**Type:** New feature (organizer self-service) + DPDPA pre-work for I-7.3.7
**Status:** 📋 Planned
**Started:** 2026-05-03
**Dependencies:** I-1.1.1 (organizer registration), I-1.1.2 (verification
documents), I-1.1.7 (Razorpay linked-account), I-1.2.x (events + cascading
children), I-2.1.1/I-2.1.2 (public event detail + organizer card), I-2.3.1
(organizer profile page), I-2.4.2/I-2.4.3/I-2.4.4 (CDN purge + cache
single-flight + sitemap regen)
**Related (forward):** I-7.3.7 (KYC document cleanup job — 1 year after
account closure); this slice creates the `organizers.deleted_at` column that
job is waiting for.

---

## Background

The organizer dashboard at `/org/profile` lets a verified or pending
organizer edit their profile (`/apps/web/src/routes/_authed/org/profile.tsx`)
but offers no way to close the account. Today an organizer who wants to
leave the platform must email support, which is friction for the launch
wedge and a DPDPA gap (the user has the right to request deletion).

The product plan and v1 plan **already specify the contract** for what
"account closure" means — this slice simply ships the user-facing flow
that drives it:

> "Organizer account closure" is the event that starts the 1-year retention
> clock for KYC documents. For V1, an organizer account is considered
> closed when the organizer requests account deletion (self-service or
> support-initiated) and EventKart sets a soft-delete timestamp on the
> organizer record. Cleanup jobs operate on `closure_timestamp + 1 year < now()`.
> — [`docs/product-plan.md` §13 line 467](../product-plan.md#L467)

> **Account closure definition (DPDPA, v2.2):** an organizer account is
> "closed" when `organizers.deleted_at` is set (soft-delete timestamp;
> populated by an admin closure action introduced under Phase 7 admin
> tooling, or by an automated inactivity sweep — neither flow ships in V1,
> so `deleted_at` is admin-set in V1). The cleanup job's eligibility query
> is `WHERE deleted_at IS NOT NULL AND deleted_at + INTERVAL '365 days' < NOW()`.
> — [`docs/v1-implementation-plan.md` line 1077, I-7.3.7](../v1-implementation-plan.md#L1077)

> `organizers` — id, user_id, business_name, **slug** (added migration
> 0015), description, city, email, email_verified_at, **razorpay_account_id**,
> verification_status, events_published_count, **deleted_at** (nullable
> timestamp; set when an organizer account is closed — powers the 1-year
> KYC retention clock used by I-7.3.7), created_at
> — [`docs/v1-implementation-plan.md` line 1555](../v1-implementation-plan.md#L1555)

The schema column is documented but **does not yet exist** in
[`packages/db/src/schema/organizers.ts`](../../packages/db/src/schema/organizers.ts).
This slice adds it, ships the self-service flow that writes it, and updates
every read path so that soft-deleted organizers vanish from public listing
surfaces while past/active events keep their full organizer card intact.

---

## User clarifications (from `vscode_askQuestions`)

| Topic               | Decision                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete-strategy`   | **A — Soft-delete organizer only, downgrade the user role, hard-delete future events.** Aligns with the documented DPDPA contract while preserving `users` FK integrity for past/active event images.                                     |
| `event-scope`       | **Free-text**: "Only delete future events. For any active or past event we unlink (i.e. keep them) — when a user searches that event he needs to find all the details of the organizer and the details properly we should not miss that." |
| `confirmation-ux`   | **Single AlertDialog with "I understand, delete" button** (no type-to-confirm).                                                                                                                                                           |
| `razorpay-handling` | **Best-effort suspend via Razorpay API + null local ref + log; never block deletion on Razorpay errors.**                                                                                                                                 |

The `event-scope` clarification reshapes the plan: instead of "hard-delete
all events," the deletion service hard-deletes only events whose
`start_at > now()` (drafts, under-review, and unstarted published events)
and **preserves every event whose `start_at <= now()`** so participants
who registered or anyone with a deep link can still see the full event
detail page including the organizer's name, city, description, and (if
applicable) verification badge.

---

## Goals

1. Organizer can self-serve close their account from `/org/profile` in
   one dialog flow.
2. The DPDPA contract (`organizers.deleted_at` set, KYC docs retained for
   365 days, audit log preserved) is honored exactly as documented.
3. Past and active events still render with full organizer info — a
   participant searching a completed event finds everything they need.
4. Future events (drafts + scheduled) are hard-deleted along with their
   cascading children (`event_categories`, `event_pricing_tiers`,
   `event_images`) and best-effort S3 object cleanup.
5. The user's session is killed across all devices, browser cookies
   cleared, the in-memory React Query cache wiped, and the user lands on
   `/` as an anonymous visitor.
6. Re-registration with the same phone/user is possible afterward
   (partial unique indexes, mirroring the `users.phone` pattern).

## Out of scope

1. **Hard-deleting the `users` row.** The human stays a logged-out
   participant who can re-register. `users.deleted_at` (column already
   exists) is **not** set in this slice — it's reserved for full participant
   account deletion, a separate DPDPA flow.
2. **Bookings refund refusal.** V1 has no participant booking flow yet
   (Phase 3); a future-events-have-paid-bookings gate is documented as a
   forward consideration with a `TODO(I-3.x)` marker only.
3. **Admin-initiated closure UI.** Reusable service ships; admin tool
   waits for Phase 7 tooling.
4. **Inactivity sweep.** Documented in the v1 plan as not-V1; not built.
5. **Public dispute / data-export form.** Belongs to I-7.2.5 / I-7.3.8
   respectively.

---

## Hard constraints surfaced during research

These shaped the plan and must be honored by the implementation.

1. **`events.organizer_id` FK is `onDelete: "restrict"`**
   ([`packages/db/src/schema/events.ts:46-48`](../../packages/db/src/schema/events.ts#L46))
   — we cannot drop the organizer first; future-event deletes must run
   before any organizer write, all in **one DB transaction**.

2. **Existing unique indexes on `organizers` are NOT partial**
   ([`packages/db/src/schema/organizers.ts:78-83`](../../packages/db/src/schema/organizers.ts#L78))
   — without dropping and recreating them as `WHERE deleted_at IS NULL`
   (mirroring [`packages/db/src/schema/users.ts:30-37`](../../packages/db/src/schema/users.ts#L30))
   the same `user_id`, `slug`, or `razorpay_account_id` can never be
   re-used after soft-delete. This breaks re-registration.

3. **`event_images.uploaded_by` is `onDelete: "restrict"`**
   ([`packages/db/src/schema/event-images.ts:41-43`](../../packages/db/src/schema/event-images.ts#L41))
   — that's why we deliberately don't touch the `users` row. If we did,
   any organizer who uploaded a hero/route-map image on a preserved past
   event would block the user delete. Soft-delete-the-user is also off
   the table for the same reason: hero rows on preserved events would
   become orphaned.

4. **Past/active event pages must keep the organizer card intact** (user
   requirement). The public-detail JOIN in
   [`apps/api/src/modules/events/public-detail-service.ts`](../../apps/api/src/modules/events/public-detail-service.ts)
   must intentionally **not** filter `deleted_at IS NULL`. Other read
   paths (organizer profile lookup, organizer-existence probe,
   getOrganizerByUserId) **must** filter it.

5. **Cookie + cache contract** (per repo memory: `apps/api/src/plugins/auth.ts`
   strips Set-Cookie from `Cache-Control: public` responses). The
   `/me/delete` endpoint sets multiple Set-Cookie clears, so it must
   declare `Cache-Control: private, no-store` explicitly. It runs under
   `requireAuth` already.

6. **Session kill is two-layered.** DB sessions don't cascade-on-user-delete
   here (we're not deleting the user). We must SELECT all
   `sessions.id WHERE user_id = $u AND revoked_at IS NULL`, mark
   `revoked_at = now()` in DB, and explicitly `DEL` each Redis session
   key. Otherwise the user stays signed in on other devices.

7. **Razorpay route accounts cannot be hard-deleted via API**, only
   suspended. Best-effort suspend, null the local reference, log; never
   block on Razorpay HTTP errors.

8. **Cache eviction must cover both organizer slug and every affected
   event slug**, plus a sitemap regen and CDN purge. Reuses the existing
   helpers in
   [`apps/api/src/lib/cache-stampede.ts`](../../apps/api/src/lib/cache-stampede.ts),
   [`apps/api/src/queues/cdn-purge.ts`](../../apps/api/src/queues/cdn-purge.ts),
   and [`apps/api/src/queues/sitemap-regen.ts`](../../apps/api/src/queues/sitemap-regen.ts).

9. **Migration numbering must use the current next slot.** The repo already
   has `0018_events_public_listing_indexes.sql` and
   `0019_drop_city_state_v1_checks.sql`, so this slice must use
   `0020_organizers_deleted_at.sql` (plus the matching rollback), not
   `0018_*`.

10. **Partial indexes are necessary but not sufficient for re-registration.**
    Service-level checks must also ignore soft-deleted organizers:
    `registerOrganizer`'s fast-path/recheck, `getOrganizerByUserId`,
    `updateOrganizer`, and `organizerSlugExists` in
    [`slug-service.ts`](../../apps/api/src/modules/organizer/slug-service.ts)
    must all add `isNull(organizers.deletedAt)` where they check active
    organizer rows. Otherwise the DB would allow re-use while the app still
    blocks it.

11. **The account-delete mutation must be browser-side.** Current organizer
    mutations in `apps/web/src/features/organizer/api.ts` are mostly
    `createServerFn` wrappers that call the API through `serverApiClient`; that
    path does **not** forward `Set-Cookie` clears from the API response back to
    the browser and also bypasses API CSRF via `X-Internal-Key`. The delete
    action must call browser `apiClient` directly so the session/CSRF cookies
    are actually cleared by the browser and the CSRF header check is exercised.

12. **Sitemap organizer rows must filter soft-deleted organizers.**
    [`apps/api/src/modules/sitemap/service.ts`](../../apps/api/src/modules/sitemap/service.ts)
    currently includes all `is_verified = true` organizers. After this slice it
    must also require `deleted_at IS NULL`; otherwise `/sitemap.xml` will keep
    advertising organizer profile URLs that intentionally 404.

---

## Architecture decisions

### D1 — Event classification rule

```text
future event   ⇔   start_at > now()    → HARD-DELETE (cascade children)
past/active    ⇔   start_at <= now()   → KEEP (organizer JOIN unfiltered)
```

This includes drafts (typically `start_at` in the future), under-review,
and published events that haven't started. Cancelled events are treated
the same way: cancelled-future → hard-delete, cancelled-past → keep.
Status is irrelevant to the cut; only `start_at` matters.

**Why `start_at > now()` and not `end_at > now()`:** an event that is
mid-flight or has a check-in window today is operationally "active" and
participants may be using it; we keep it. An event that ends today but
started already is "past." We use `start_at` so the cut is unambiguous
and matches the participant's mental model: "the event hasn't happened
yet."

### D2 — Soft-delete the organizer, never the user (V1)

`organizers.deleted_at = now()` + downgrade `users.role` from `organizer`
back to `participant`. The user row stays alive so:

- The phone number is freed for re-registration via the existing
  `users_phone_unique` partial index (already `WHERE deleted_at IS NULL`).
- Hero/route-map images on preserved past events keep their
  `uploaded_by` reference satisfied.
- The user can still book events as a participant if Phase 3 ships.

If they ever want to fully delete the participant identity too, that's
a separate DPDPA flow.

### D3 — Single transaction, ordered writes

Inside one `db.transaction(async (tx) => { … })`:

1. `SELECT … FOR UPDATE` the organizer (lock the row, throw 404 if
   missing or `deleted_at IS NOT NULL` — idempotency).
2. `SELECT id, slug, start_at, status` for all events of this organizer;
   split into `futureEvents` and `preservedEvents` arrays in JS.
3. For each future event: SELECT `event_images.storage_key WHERE status IN ('pending','uploaded')`
   (collected for post-tx S3 cleanup); DELETE FROM
   `slug_redirects WHERE resource_type='event' AND resource_id=$id`; DELETE
   FROM `events WHERE id=$id` (cascades `event_categories` →
   `event_pricing_tiers`, `event_images`).
4. DELETE FROM
   `slug_redirects WHERE resource_type='organizer' AND resource_id=$organizerId`.
5. UPDATE
   `organizers SET deleted_at=now(), razorpay_account_id=NULL, razorpay_account_status='not_started' WHERE id=$organizerId`.
6. UPDATE `users SET role='participant' WHERE id=$userId`.
7. SELECT `id FROM sessions WHERE user_id=$userId AND revoked_at IS NULL`
   (returned to caller for Redis cleanup).
8. UPDATE
  `sessions SET revoked_at=now() WHERE user_id=$userId AND revoked_at IS NULL`.
9. `auditLogger.log({ action: AUDIT_ACTIONS.ORGANIZER_DELETE, resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER, resourceId: $organizerId, metadata: { deletedEventSlugs, preservedEventSlugs, hadRazorpayAccount, razorpayAccountIdHash } })`.

The transaction returns
`{ organizerSlug, deletedEventSlugs, preservedEventSlugs, sessionIds, storageKeys, razorpayAccountId }`.

### D4 — Post-transaction side effects

Mirror the patterns already used by `invalidateEventCache()` in
[`apps/api/src/modules/events/service.ts`](../../apps/api/src/modules/events/service.ts):
most non-auth side effects are fire-and-forget, log on failure, and never
re-throw. **Session invalidation is the exception**: it must be awaited before
the route sends the success response because Redis is the primary session
store and `sessions.revoked_at` is only audit metadata today. Order:

1. **Session kill across devices** — for each session ID returned by the
   tx: call `deleteRedisSession(sessionRedis, sessionId)` and await the
   batch. Log any per-session deletion failures with session IDs, and add a
   route test proving Redis deletion is awaited before response completion.
   The caller will also `clearCookie` on the response so the current browser
   is logged out even if another device has a transient Redis cleanup issue.
2. **Origin cache eviction** — `invalidatePublicOrganizerCache(redis.cache, organizerSlug)`;
  for every slug in `[...deletedEventSlugs, ...preservedEventSlugs]` call
  `invalidatePublicEventCache(redis.cache, slug)`. Preserved events need re-render so the new
   `organizer.isActive: false` flag (D5) propagates.
3. **CDN purge** — single chunked `enqueueCdnPurge` job with the
   organizer URL, every deleted event URL, every preserved event URL,
   and `/sitemap.xml`. The 30-URL chunking inside the helper handles the
   batching.
4. **Sitemap regen** — `enqueueSitemapRegen(queue, { reason: "organizer_account_deleted" })`.
  Debounced inside the helper.
5. **S3 object cleanup** — for each storage key collected in step D3.3:
   `Promise.allSettled(keys.map(k => storage.deleteObject(k)))`. Track
   failures in the audit metadata or a follow-up log line; do not throw.
6. **Razorpay suspend** — if `razorpayAccountId` was set: best-effort
   POST to suspend the linked account. Use existing helpers in
   `apps/api/src/lib/razorpay*.ts` if a suspend method exists; otherwise
   log a `TODO(razorpay-suspend)` with a non-secret identifier such as the
   account-id suffix/hash for ops follow-up. Never block deletion and do not
   write the raw account ID to normal application logs.
7. **Email stub** — `emitEmailStub({ jobName: EMAIL_JOB_NAMES.ORGANIZER_ACCOUNT_DELETED, idempotencyKey: buildEmailIdempotencyKey.organizerAccountDeleted(organizerId), context: { organizerId, deletedEventCount, preservedEventCount } })`.

### D5 — Public surfaces show "no longer active" on preserved events

The shared schemas
`eventPublicOrganizerSummarySchema` (embedded on event detail) and
`organizerPublicProfileSchema` (standalone profile) gain
`isActive: z.boolean().optional()`. Consumers default with
`organizer.isActive ?? true`. **Do not use a Zod `.default(true)` here**:
parsing would materialize an `isActive: true` key on every active organizer,
breaking the existing exact-key public payload tests and making the payload
less backward-compatible. The API only emits `false` when the organizer row's
`deleted_at IS NOT NULL`.

The web component
`PublicEventOrganizerCard`
([`apps/web/src/features/event-detail/components/`](../../apps/web/src/features/event-detail/components/))
checks `organizer.isActive ?? true`:

- When `false`: render a small muted note "This organizer is no longer
  active on EventKart." beneath the business name; **hide the
  `<Link to="/organizers/$slug">` "View profile" link** (the page 404s).
- When `true`: today's behaviour, unchanged.

`/organizers/:slug` for a soft-deleted organizer returns 404 (no
redirect), and `GET /api/v1/events/public?organizerSlug=…` for a
soft-deleted organizer returns `data: []`, `meta.total: 0`. Events from
soft-deleted organizers **still appear on the homepage listing** (`/`)
because past events are valid content for participants.

### D6 — UX (single dialog, deletion preview on open)

Danger zone card on `/org/profile` below the existing
`<OrganizerProfileForm />`. The "Delete organizer account" button opens
a shadcn `AlertDialog` (same pattern as
[`apps/web/src/features/events/components/publish-action.tsx`](../../apps/web/src/features/events/components/publish-action.tsx)).

On open, the dialog lazily fetches `GET
/api/v1/organizers/me/deletion-preview` (TanStack Query, `enabled: open`)
and renders:

- Organizer business name (echo for re-confirmation)
- **Future events that will be permanently deleted** — list of `title +
  startAt`, count, hidden when zero
- **Past and active events that will be preserved** — count + copy:
  "These events will remain visible to participants who registered and
  to anyone who has the link, with your organizer details still shown."
- **KYC retention notice** — "Your verification documents will be
  retained for 365 days as required by law and then deleted automatically."
- **Razorpay note** (when `hasRazorpayAccount`) — "Your linked Razorpay
  account will be suspended."
- Confirm button: destructive variant, label "I understand, delete my
  organizer account". Loading state while mutation runs.
- Cancel button: closes dialog.

On successful mutation:

1. `queryClient.clear()` — wipe ALL cached queries (organizer profile,
   verification status, event lists may all be stale)
2. `useAuthActions().clearSession()` — clear local auth state
3. `toast.success("Organizer account deleted.")`
4. `navigate({ to: "/", replace: true })`

On failure: `toastRetry("Failed to delete account", { onRetry: … })`,
mirroring [`apps/web/src/components/layout/authed-sidebar.tsx`](../../apps/web/src/components/layout/authed-sidebar.tsx)'s
logout-failure pattern.

---

## Phases

Steps within a phase that are marked `(parallel)` are independent and may be
implemented concurrently; the phase itself is sequential.

### Phase 1 — DB + shared constants foundation

1. **Drizzle migration `0020_organizers_deleted_at.sql`:**
   - `ALTER TABLE organizers ADD COLUMN deleted_at TIMESTAMPTZ NULL;`
   - Create replacement partial unique indexes before dropping the stricter
     existing indexes to avoid any duplicate-write window during deploy. Use
     temporary names if needed, then drop/rename to the schema names expected
     by Drizzle.
   - Replace `organizers_user_id_unique`, `organizers_slug_unique`, and
     `organizers_razorpay_account_id_unique` with partial unique indexes
     `WHERE deleted_at IS NULL`; the Razorpay index keeps its logical
     `razorpay_account_id IS NOT NULL` filter combined with
     `AND deleted_at IS NULL`.
   - `CREATE INDEX organizers_deleted_at_idx ON organizers (deleted_at)
     WHERE deleted_at IS NOT NULL;` (powers I-7.3.7's eligibility query).
   - Review lock risk explicitly. If the migration runner cannot support
     `CREATE INDEX CONCURRENTLY`, either schedule a launch-safe maintenance
     window for this pre-launch table or use a one-off non-transactional
     migration path; do not silently introduce a production write-blocking
     index build.
   - Forward and rollback both checked into `packages/db/drizzle/`.

2. **Schema TS update** in
   [`packages/db/src/schema/organizers.ts`](../../packages/db/src/schema/organizers.ts):
   - Add `deletedAt: timestamp("deleted_at", { withTimezone: true })`.
   - Convert the three unique indexes to `uniqueIndex(...).on(...).where(sql\`deleted_at IS NULL\`)`.
   - Add the partial `deleted_at_idx` index.
   - Run `pnpm --filter @repo/db db:generate` and verify the generated
     SQL matches the hand-written migration byte-for-byte (or supersede
     it with the generated file if drizzle-kit picks a slightly different
     ordering).

3. **Audit + email job constants** _(parallel)_:
   - [`packages/shared/src/constants/audit.ts`](../../packages/shared/src/constants/audit.ts)
     add `ORGANIZER_DELETE: "organizer.delete"`.
   - [`packages/shared/src/constants/email-jobs.ts`](../../packages/shared/src/constants/email-jobs.ts)
     add `EMAIL_JOB_NAMES.ORGANIZER_ACCOUNT_DELETED` +
     `buildEmailIdempotencyKey.organizerAccountDeleted(organizerId)`.

4. **Shared public schemas** _(parallel)_:
   - `packages/shared/src/schemas/event-public-detail.ts` (or wherever
     `eventPublicOrganizerSummarySchema` lives) — append
     `isActive: z.boolean().optional()`.
   - `packages/shared/src/schemas/organizer-public-profile.ts` — same.
   - Keep active organizers backward-compatible by omitting the field or
     emitting `true`; component code must use `organizer.isActive ?? true`.

### Phase 2 — API: deletion service + routes

5. **New `apps/api/src/modules/organizer/deletion-service.ts`** _(parallel
   with 6, 7)_:
   - `previewOrganizerDeletion(db, userId): Promise<{ futureEvents:
     {id, slug, title, startAt, status}[]; preservedEventCount: number;
     hasRazorpayAccount: boolean; kycDocumentCount: number }>`
   - `deleteOrganizerAccount(deps, userId, ctx): Promise<{ deletedEventCount:
     number; preservedEventCount: number; sessionIds: string[];
     organizerSlug: string; deletedEventSlugs: string[];
     preservedEventSlugs: string[]; storageKeys: string[];
     razorpayAccountId: string | null }>` — runs the D3 transaction.
   - `runDeletionSideEffects(deps, txResult)` — runs the D4 post-tx
     side effects in order. It must await Redis session deletion first;
     later cache/CDN/sitemap/S3/Razorpay/email steps remain fail-soft with
     try/catch + `Promise.allSettled` where appropriate.

6. **Routes** in
   [`apps/api/src/modules/organizer/routes.ts`](../../apps/api/src/modules/organizer/routes.ts)
   _(parallel with 5, 7)_:
   - `GET /api/v1/organizers/me/deletion-preview`
     - `preHandler: [requireAuth, requireRole("organizer")]`
     - Response schema in
       [`apps/api/src/modules/organizer/schemas.ts`](../../apps/api/src/modules/organizer/schemas.ts):
       new `organizerDeletionPreviewResponseSchema`
     - Sets `Cache-Control: private, no-store`
   - `POST /api/v1/organizers/me/delete`
     - `preHandler: [requireAuth, requireRole("organizer")]`
     - CSRF protection on (default for POST)
     - Calls `deleteOrganizerAccount(...)` then `runDeletionSideEffects(...)`
     - Clears session cookie + CSRF cookie via `buildSessionCookieOptions`
       and `buildCsrfClearOptions` (mirror the `/auth/logout` handler in
       [`apps/api/src/modules/auth/routes.ts`](../../apps/api/src/modules/auth/routes.ts))
     - Sets `Cache-Control: private, no-store`
     - Response schema: `organizerDeletionResponseSchema` with
       `{ message, deletedEventCount, preservedEventCount }`

7. **Read-path updates** across the organizer module _(parallel with 5, 6)_.
   Add `isNull(organizers.deletedAt)` to:
   - [`organizer/service.ts`](../../apps/api/src/modules/organizer/service.ts)
     `registerOrganizer`'s optimistic existing-profile check, the 23505
     recheck path, `getOrganizerByUserId`, and the existence check inside
     `updateOrganizer`.
     - **Effect:** soft-deleted organizers see the "no organizer profile"
       state on `/org/profile` and can re-register via `/org/register`.
   - [`organizer/slug-service.ts`](../../apps/api/src/modules/organizer/slug-service.ts)
     `organizerSlugExists` filters `isNull(deletedAt)` for organizer-table
     checks, while still checking `slug_redirects.old_slug` after the deletion
     service removes redirect rows for the deleted organizer.
   - [`organizer/public-profile-service.ts`](../../apps/api/src/modules/organizer/public-profile-service.ts)
     `lookupPublicOrganizerBySlug` throws the existing not-found error path
     for soft-deleted organizers. The slug-redirect lookup must also bail to
     not-found if the **target** organizer is soft-deleted (loop-guard parity
     with the existing chained-rename logic).
   - [`organizer/next-event-service.ts`](../../apps/api/src/modules/organizer/next-event-service.ts)
     `organizerExistsById` filters `isNull(deletedAt)` so the
     `GET /organizers/{id}/next-event` internal endpoint returns 404
     (post-event email worker won't email a deleted organizer's
     followers).
   - [`organizer/verification-status-service.ts`](../../apps/api/src/modules/organizer/verification-status-service.ts),
     [`organizer/policy-service.ts`](../../apps/api/src/modules/organizer/policy-service.ts),
     [`organizer/document-service.ts`](../../apps/api/src/modules/organizer/document-service.ts)
     — every organizer-existence check filters `isNull(deletedAt)`.

8. **Events read-path updates** _(depends on 7 conceptually but separate
   files)_:
   - [`events/public-detail-service.ts`](../../apps/api/src/modules/events/public-detail-service.ts):
     project `organizers.deletedAt` from the JOIN; map it to
     `organizer.isActive: false` only when `row.deletedAt !== null`.
     **Do not filter the JOIN on `deletedAt`** — preserved past events
     must keep showing the organizer card.
   - [`events/public-listing-service.ts`](../../apps/api/src/modules/events/public-listing-service.ts):
     when `organizerSlug` filter is passed, the existing subquery
     `organizerId IN (SELECT id FROM organizers WHERE slug=$1)` becomes
     `… WHERE slug=$1 AND deleted_at IS NULL`. When no organizer filter,
     the homepage listing is unchanged — past events from soft-deleted
     organizers still appear (they're real content for participants).
   - [`sitemap/service.ts`](../../apps/api/src/modules/sitemap/service.ts):
     organizer sitemap rows become `is_verified = true AND deleted_at IS NULL`
     so a self-deleted organizer profile is removed from `/sitemap.xml` after
     the queued regen.

### Phase 3 — Frontend

9. **API client** _(parallel with 10, 11)_ — additions in
   [`apps/web/src/features/organizer/api.ts`](../../apps/web/src/features/organizer/api.ts):
   - `getOrganizerDeletionPreview()` — browser-side `apiClient` call
   - `deleteOrganizerAccount()` — browser-side `apiClient` POST
   - These two functions should **not** be `createServerFn` wrappers. The
     delete POST must be a direct browser request so API `Set-Cookie` clears
     land in the browser and API CSRF remains covered.
   - Add `organizerDeletionPreviewQueryOptions()` to
     [`apps/web/src/features/organizer/queries.ts`](../../apps/web/src/features/organizer/queries.ts)
     keyed `["organizer-deletion-preview"]`, `staleTime: 0`,
     `gcTime: 0` so the preview is always re-fetched fresh on dialog open.

10. **`<DeleteOrganizerSection />` component** _(parallel with 9, 11)_ —
    new file
    `apps/web/src/features/organizer/components/delete-organizer-section.tsx`:
    - Card with destructive border (use the existing
      `border-destructive/40` Tailwind pattern from publish-action.tsx)
    - `<AlertDialog>` (open state local to the card)
    - On open: `useQuery({ ...organizerDeletionPreviewQueryOptions(), enabled: open })`
    - Dialog body renders preview per D6
    - Confirm `useMutation`:
      - `onSuccess`: `queryClient.clear()` → `clearSession()` →
        `toast.success(...)` → `navigate({ to: "/", replace: true })`
      - `onError`: `toastRetry(...)` mirroring `authed-sidebar.tsx` lines 95-102

11. **Wire into `/org/profile`** _(parallel with 9, 10)_ — update
    [`apps/web/src/routes/_authed/org/profile.tsx`](../../apps/web/src/routes/_authed/org/profile.tsx)
    to render `<DeleteOrganizerSection profile={profileQuery.data} />`
    below `<OrganizerProfileForm />`.

12. **`PublicEventOrganizerCard` "no longer active" note** _(depends on
    Phase 1 step 4 — shared schema change must be in place first)_:
    - Update
      [`apps/web/src/features/event-detail/components/`](../../apps/web/src/features/event-detail/components/)
      (the file containing `PublicEventOrganizerCard`)
    - Read `organizer.isActive ?? true`
    - When `false`: render `<p className="text-sm text-muted-foreground italic">This organizer is no longer active on EventKart.</p>`
      below the business name; suppress the `<Link to="/organizers/$slug">`
      profile link AND the `<VerificationExplainer variant="popover" />`
      trigger (the explainer talks about ongoing onboarding checks; not
      meaningful for an inactive org)

### Phase 4 — Tests

13. **API service tests** —
    `apps/api/test/modules/organizer/deletion-service.test.ts` (new):
    - Happy path: organizer with mix of future + past events → future
      hard-deleted, past preserved, organizer `deleted_at` set, user
      role downgraded, sessions revoked + Redis cleared, audit log
      written
    - Future event with images: storage keys passed to `deleteObject` in
      post-tx step (assert `Promise.allSettled` shape)
    - Razorpay-linked: suspend attempted, local ref cleared, deletion
      succeeds even when suspend throws
    - Idempotency: second call returns 404
    - Slug-redirect cleanup: rows for `resource_type='organizer'` AND
      `resource_type='event'` (deleted slugs only) removed
    - Re-registration after deletion: new organizer registration with
      same `userId` and same business-name-derived slug succeeds (partial
      unique index + `registerOrganizer` + `slug-service` filters honored)
    - Redis session deletion is awaited before the route returns; cache/CDN/S3
      failures are fail-soft but session cleanup is not fire-and-forget
    - Preview: returns correct future/preserved counts, `hasRazorpayAccount`,
      and `kycDocumentCount`

14. **API route tests** — `apps/api/test/modules/organizer/routes-deletion.test.ts`:
    - 401 without session
    - 403 with non-organizer role
    - Preview endpoint shape correct
    - Delete endpoint clears Set-Cookie session + CSRF (assert
      `clearOptions` honored)
    - CSRF protection enforced on POST (Origin/CSRF token tests)
    - Browser-style delete request receives cookie-clearing headers; do not
      exercise the delete flow through `serverApiClient`/`X-Internal-Key`
    - `Cache-Control: private, no-store` on both endpoints

15. **API read-path regression tests**:
    - `public-profile-service.test.ts`: 404 when soft-deleted; redirect
      target check fails to not-found if target is soft-deleted
    - `public-detail-service.test.ts`: preserved past event returns
      organizer summary with `isActive: false`; deleted future event
      returns 404; active event with active organizer still returns
      `isActive: true` (default-on)
    - `public-listing-service.test.ts`: `organizerSlug` filter on
      soft-deleted org → empty list + `meta.total: 0`; no filter →
      homepage unchanged
    - `next-event.test.ts`: `organizerExistsById` returns false for
      soft-deleted
    - `slug-service.test.ts`: deleted organizer slug no longer blocks a new
      organizer after deletion removed that organizer's redirect rows
    - `sitemap/service.test.ts`: verified soft-deleted organizer is excluded
      from generated XML

16. **Web component tests**:
    - `delete-organizer-section.test.tsx`: dialog opens → preview fetched
      → future events listed → confirm calls mutation → on success
      `queryClient.clear` + `clearSession` + `navigate` happen in order;
      failure path shows `toastRetry`; API mocks assert browser `apiClient`
      is used for the delete POST
    - `public-event-organizer-card.test.tsx`: renders inactive note when
      `isActive: false`, hides profile link + verification explainer;
      unchanged when `isActive: true` or omitted

17. **Migration smoke test** — apply `0020` forward, verify partial
    indexes exist via `pg_indexes`, verify rollback drops them cleanly.

### Phase 5 — Verification + docs

18. **Local validation:**
    - `pnpm --filter @repo/db db:migrate:run` against local Postgres;
      `\d+ organizers` confirms the column + 4 indexes
    - `pnpm --filter @repo/db db:check:drift`
    - `pnpm --filter @repo/db db:check:rollbacks`
    - Review lock-risk for the new `0020` migration. Note: the current
      repository-wide `db:check:lock-risk` reports pre-existing findings in
      older migrations, so either improve/baseline that checker first or run a
      targeted analysis against the new migration and document the result.
    - `pnpm --filter @repo/shared test`
    - `pnpm --filter api exec vitest run test/modules/organizer test/modules/events`
    - `pnpm --filter api test` (full)
    - `pnpm --filter web exec vitest run src/features/organizer src/features/event-detail`
    - `pnpm --filter web test` (full)
    - `pnpm check-types`
    - `pnpm lint`

19. **Manual E2E in dev:**
    - Seed an organizer (verified) with two future events (one with hero
      image) + one past event + at least one Razorpay link if local
      Razorpay credentials present
    - Log in as the organizer, navigate to `/org/profile`
    - Click "Delete organizer account"
    - Verify dialog shows future events list, preserved count, KYC
      notice, Razorpay note
    - Confirm; verify:
      - Redirect to `/`
      - DevTools → Application → Cookies: session + CSRF cleared
      - Refresh of past event detail URL still renders organizer card
        with the muted "no longer active" note + no profile link
      - `/organizers/<slug>` returns 404
      - `/api/v1/events/public?organizerSlug=<slug>` returns
        `data: [], meta.total: 0`
      - Re-register via `/login` (same phone) → OTP → `/org/register`
        succeeds (partial unique index works)
    - DB: `SELECT deleted_at FROM organizers WHERE id=…` is non-null;
      `SELECT * FROM events WHERE organizer_id=…` only returns the
      preserved past event(s); `SELECT * FROM event_categories WHERE
      event_id IN (deleted_ids)` is empty (cascade worked); audit log
      has the `organizer.delete` row

20. **Progress + plan sync** (post-merge):
    - Add row to [`progress.md`](../../progress.md) under "Active
      Implementation Plans" — references this file
    - Update [`docs/v1-implementation-plan.md`](../v1-implementation-plan.md)
      "Current State" — add a row noting `organizers.deleted_at` now
      exists (unblocks I-7.3.7) and a self-service deletion flow ships
      ahead of the original Phase 7 admin-tooling slot
    - Add `TODO(I-3.x bookings gate)` comment in
      `deletion-service.ts` near the future-event collection step

---

## Forward considerations (call out, don't build now)

1. **Phase 3 bookings gate.** When I-3.x ships participant bookings, the
   deletion service must (a) refuse deletion if any future event has
   paid bookings (refund obligation), and (b) optionally surface a
   warning if the user has active bookings as a participant (their
   participant identity is unaffected by organizer deletion, but the
   dialog should mention it). Add a `TODO(I-3.x)` comment in
   `deletion-service.ts` step 3 (future-event collection) and in the
   dialog body component.
2. **I-7.3.7 hookup.** This work creates the `deleted_at` column the
   cleanup job is waiting for. When I-7.3.7 ships, no schema changes
   needed; the job queries
   `WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '365 days'`
   and hard-deletes `verification_documents` rows + S3 keys. Document
   this in the merge PR description.
3. **Admin-initiated closure (Phase 7).** The same
   `deleteOrganizerAccount` service is reusable for an admin tool. The
   audit logger already accepts an actor identity, so admin-vs-self
   distinction is captured automatically.
4. **Inactivity sweep.** Documented in the v1 plan as not-V1; if
   added later, it just calls the same `deleteOrganizerAccount` service
   with a system actor.
5. **Razorpay suspend helper.** If the existing `apps/api/src/lib/razorpay*.ts`
   doesn't expose a suspend method, this slice ships a `TODO(razorpay-suspend)`
   log line with a non-secret account suffix/hash. A small follow-up adds the
   helper. Do not block this slice on it.
6. **Email template.** The `ORGANIZER_ACCOUNT_DELETED` job is a
   `emitEmailStub` log-only entry per the Phase-2 readiness pattern (W2.1).
   The real Resend template ships with I-3.3.1 (Phase 3).

---

## Relevant files

### Schema + shared

- [`packages/db/src/schema/organizers.ts`](../../packages/db/src/schema/organizers.ts)
- `packages/db/drizzle/0020_organizers_deleted_at.sql` (new)
- `packages/db/drizzle/rollbacks/0020_organizers_deleted_at.rollback.sql` (new)
- [`packages/db/src/schema/users.ts`](../../packages/db/src/schema/users.ts)
  (reference for partial unique index pattern)
- [`packages/shared/src/constants/audit.ts`](../../packages/shared/src/constants/audit.ts)
- [`packages/shared/src/constants/email-jobs.ts`](../../packages/shared/src/constants/email-jobs.ts)
- `packages/shared/src/schemas/event-public-detail.ts`
- `packages/shared/src/schemas/organizer-public-profile.ts`

### API — new

- `apps/api/src/modules/organizer/deletion-service.ts`
- `apps/api/test/modules/organizer/deletion-service.test.ts`
- `apps/api/test/modules/organizer/routes-deletion.test.ts`

### API — modified

- [`apps/api/src/modules/organizer/routes.ts`](../../apps/api/src/modules/organizer/routes.ts)
- [`apps/api/src/modules/organizer/schemas.ts`](../../apps/api/src/modules/organizer/schemas.ts)
- [`apps/api/src/modules/organizer/service.ts`](../../apps/api/src/modules/organizer/service.ts)
- [`apps/api/src/modules/organizer/slug-service.ts`](../../apps/api/src/modules/organizer/slug-service.ts)
- [`apps/api/src/modules/organizer/public-profile-service.ts`](../../apps/api/src/modules/organizer/public-profile-service.ts)
- [`apps/api/src/modules/organizer/next-event-service.ts`](../../apps/api/src/modules/organizer/next-event-service.ts)
- [`apps/api/src/modules/organizer/verification-status-service.ts`](../../apps/api/src/modules/organizer/verification-status-service.ts)
- [`apps/api/src/modules/organizer/policy-service.ts`](../../apps/api/src/modules/organizer/policy-service.ts)
- [`apps/api/src/modules/organizer/document-service.ts`](../../apps/api/src/modules/organizer/document-service.ts)
- [`apps/api/src/modules/events/public-detail-service.ts`](../../apps/api/src/modules/events/public-detail-service.ts)
- [`apps/api/src/modules/events/public-listing-service.ts`](../../apps/api/src/modules/events/public-listing-service.ts)
- [`apps/api/src/modules/sitemap/service.ts`](../../apps/api/src/modules/sitemap/service.ts)

### API — reused (no changes)

- [`apps/api/src/lib/cache-stampede.ts`](../../apps/api/src/lib/cache-stampede.ts) — `invalidatePublicEventCache`, `invalidatePublicOrganizerCache`
- [`apps/api/src/queues/cdn-purge.ts`](../../apps/api/src/queues/cdn-purge.ts) — `enqueueCdnPurge`
- [`apps/api/src/queues/sitemap-regen.ts`](../../apps/api/src/queues/sitemap-regen.ts) — `enqueueSitemapRegen`
- [`apps/api/src/lib/storage.ts`](../../apps/api/src/lib/storage.ts) — `deleteObject`
- [`apps/api/src/lib/audit.ts`](../../apps/api/src/lib/audit.ts) — `createAuditLogger`
- [`apps/api/src/lib/session.ts`](../../apps/api/src/lib/session.ts) — `deleteRedisSession`
- [`apps/api/src/lib/email-stub.ts`](../../apps/api/src/lib/email-stub.ts) — `emitEmailStub`
- [`apps/api/src/modules/auth/routes.ts`](../../apps/api/src/modules/auth/routes.ts) — reference for cookie clear pattern

### Web — new

- `apps/web/src/features/organizer/components/delete-organizer-section.tsx`
- `apps/web/src/features/organizer/components/delete-organizer-section.test.tsx`

### Web — modified

- [`apps/web/src/routes/_authed/org/profile.tsx`](../../apps/web/src/routes/_authed/org/profile.tsx)
- [`apps/web/src/features/organizer/api.ts`](../../apps/web/src/features/organizer/api.ts)
- [`apps/web/src/features/organizer/queries.ts`](../../apps/web/src/features/organizer/queries.ts)
- `apps/web/src/features/event-detail/components/` (the file containing
  `PublicEventOrganizerCard`)
- Existing tests for `PublicEventOrganizerCard`

### Web — reused (no changes)

- [`apps/web/src/components/layout/authed-sidebar.tsx`](../../apps/web/src/components/layout/authed-sidebar.tsx) — reference for `clearSession + navigate` post-logout pattern
- [`apps/web/src/features/events/components/publish-action.tsx`](../../apps/web/src/features/events/components/publish-action.tsx) — reference for AlertDialog destructive pattern
- `@repo/ui/components/ui/alert-dialog`

### Docs

- [`progress.md`](../../progress.md) — add a row when shipped
- [`docs/v1-implementation-plan.md`](../v1-implementation-plan.md) — update Current State

---

## Task Tracking

| Task                                                           | Owner       | Status      | Size      | Notes                                                                                                         |
| -------------------------------------------------------------- | ----------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Phase 1.1 — migration `0020_organizers_deleted_at.sql`         | implementer | Not started | Small/Yel | Mirror users.ts partial-index pattern; include rollback; review lock risk + current migration numbering       |
| Phase 1.2 — schema TS update                                   | implementer | Not started | Small/Yel |                                                                                                               |
| Phase 1.3 — audit + email job constants                        | implementer | Not started | Small/Yel |                                                                                                               |
| Phase 1.4 — shared `isActive` schema field                     | implementer | Not started | Small/Yel | Optional field; consumers default with `?? true`                                                              |
| Phase 2.5 — `deletion-service.ts` (preview + delete + side-fx) | implementer | Not started | Large/Red | Single transaction; Redis session deletion awaited before fail-soft side effects                              |
| Phase 2.6 — routes + Cache-Control headers                     | implementer | Not started | Med/Yel   | Mirror `/auth/logout` cookie clear                                                                            |
| Phase 2.7 — organizer read-path filters                        | implementer | Not started | Med/Yel   | Include registerOrganizer fast/recheck paths and slug-service active-row checks                               |
| Phase 2.8 — events + sitemap read-path projections             | implementer | Not started | Med/Yel   | public-detail JOIN keeps unfiltered; public-listing organizerSlug + sitemap organizer rows respect deleted_at |
| Phase 3.9 — web API client + queries                           | implementer | Not started | Small/Yel | Delete POST must use browser apiClient, not createServerFn/serverApiClient                                    |
| Phase 3.10 — `<DeleteOrganizerSection />`                      | implementer | Not started | Med/Yel   | Mirror publish-action.tsx AlertDialog pattern                                                                 |
| Phase 3.11 — wire into `/org/profile`                          | implementer | Not started | Small/Yel |                                                                                                               |
| Phase 3.12 — `PublicEventOrganizerCard` inactive note          | implementer | Not started | Small/Yel | Hide profile link + verification explainer when inactive                                                      |
| Phase 4.13 — service unit tests                                | implementer | Not started | Med/Yel   |                                                                                                               |
| Phase 4.14 — route tests                                       | implementer | Not started | Med/Yel   |                                                                                                               |
| Phase 4.15 — read-path regression tests                        | implementer | Not started | Med/Yel   |                                                                                                               |
| Phase 4.16 — web component tests                               | implementer | Not started | Med/Yel   |                                                                                                               |
| Phase 4.17 — migration smoke test                              | implementer | Not started | Small/Yel |                                                                                                               |
| Phase 5.18 — local validation (lint, types, full suites)       | implementer | Not started | Small/Yel |                                                                                                               |
| Phase 5.19 — manual E2E walk-through                           | implementer | Not started | Med/Yel   |                                                                                                               |
| Phase 5.20 — progress + v1-plan sync                           | implementer | Not started | Small/Yel | Per `.github/instructions/progress-tracking.instructions.md`                                                  |
| Adversarial plan review (GPT 5.5)                              | reviewer    | Not started | Med/Yel   | Run before implementation begins                                                                              |
| Adversarial code review (GPT 5.5)                              | reviewer    | Not started | Med/Yel   | Run after Phases 1–4                                                                                          |
| Review fix loop                                                | implementer | Not started | Tbd       | Address findings; re-review                                                                                   |

---

## Verification Ledger

(to be populated during implementation — mirror the format in
`docs/impl-plan/feature-1.2-I-1.2.6.md`)

| When | What | Method | Findings | Passed | Notes |
| ---- | ---- | ------ | -------- | ------ | ----- |
|      |      |        |          |        |       |
