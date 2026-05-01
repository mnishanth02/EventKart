# I-2.4.2 — Cloudflare CDN cache invalidation on event mutations

**Feature ID:** I-2.4.2
**Module:** 2.4 — Public CDN, SEO, and Caching
**Status:** Implemented
**Dependencies:**
- I-2.4.1 (CDN setup — Cloudflare zone configuration, page rules, ops doc).
- I-2.4.3 (origin Redis single-flight + `invalidatePublicEventCache`) — this work consumes the `invalidateEventCache` integration point that I-2.4.3 introduced and removes its `TODO(I-2.4.2)` marker.
**Coexists with:** I-2.4.4 — sitemap regen. We share the queue plugin and `apps/api/src/queues/` directory; we both purge `/sitemap.xml` (this ticket evicts the edge copy via Cloudflare; I-2.4.4 regenerates the origin Redis cache).
**Reference runbook:** [`docs/operations/cloudflare-cdn-setup.md`](../operations/cloudflare-cdn-setup.md) — zone config, page rules, rate limits, token rotation, runbooks.

## Problem

The Cloudflare CDN serves SSR'd event detail and organizer profile pages with a 60-second `s-maxage` and a 5-minute `stale-while-revalidate` window (see `tanstack-start.instructions.md` §"Caching"). When an organizer publishes, unpublishes, or amends a published event — or when an admin approves/rejects a moderation submission — the cached HTML at the edge can be **5+ minutes stale** before the next purge cycle. That window leaks pricing changes, capacity changes, draft titles, and (worst case) events that have been pulled from sale.

I-2.4.3 already wired an origin-side Redis `DEL` so the Fastify single-flight gate clears immediately. But the Cloudflare edge bytes are independent of origin Redis — they survive the `DEL` until either the `s-maxage` runs out or a CDN-level purge fires. Without this ticket, the edge is the lagging cache.

## Approach

Add a **fail-soft, BullMQ-mediated Cloudflare purge pipeline** with a single integration point — `invalidateEventCache` — that the publish/unpublish/policy/admin paths already call.

**Why a queue, not an inline `fetch`:**
- Cloudflare's purge endpoint is rate-limited (1000 purges per zone per 5 minutes — ops doc §5). A burst of admin actions cannot be allowed to back-pressure the API request thread.
- A 30-URL per-request limit forces chunking; doing this inside the request handler would couple HTTP latency to the (potentially slow) Cloudflare API.
- Retry semantics: we want 3 attempts with exponential backoff, which BullMQ provides for free. Inline retries would double the request timeout and surface to the user as a "publish hung" experience.
- Worker isolation: the worker process already runs separately on Railway, so a misbehaving Cloudflare API never touches the API process's event loop.

**Fail-soft contract** — the most important property. The mutation has *already committed* by the time `invalidateEventCache` runs. Nothing in the purge pipeline is allowed to:
1. Throw out of `invalidateEventCache` (mutation success would otherwise look like a 5xx to the caller).
2. Block the request thread on a Cloudflare HTTP round-trip.
3. Mask a configuration error so silently that ops can't detect it (we log at `info` when initialized and `warn` on every purge failure).

The pipeline degrades cleanly across four conditions:

| Condition                                         | Behavior                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Queue undefined (test, queue plugin not loaded)   | `enqueueCdnPurge` returns `null` and emits a `debug` log.               |
| `CDN_BASE_URL` unset                              | Service skips URL construction (the URLs would be relative). Mutation succeeds. |
| `CLOUDFLARE_PURGE_ENABLED=false` (or unset)       | Worker still runs but the client is a no-op stub that debug-logs each job. |
| Cloudflare API returns 4xx/5xx or network error   | Worker logs `warn` with structured context; BullMQ retries 3× exponential 5s/10s/20s; eventually moves to DLQ. |

## Cloudflare API constraints

From the ops runbook (`docs/operations/cloudflare-cdn-setup.md`):

- **Endpoint:** `POST https://api.cloudflare.com/client/v4/zones/{zoneId}/purge_cache`.
- **Auth:** `Authorization: Bearer {API_TOKEN}` — token scope must be `Zone — Cache Purge` only (least privilege).
- **Body shape:** `{files: [absoluteUrl, …]}` for URL-based purge, `{tags: [...]}` for Cache-Tag purge (Enterprise feature; included for forward compatibility but not used today).
- **30 URLs per request** — `purge_cache` returns `400 You may only purge up to 30 files per API call` if exceeded. The client chunks payloads on the caller's behalf.
- **1000 purges per zone per 5 minutes** — the worker's concurrency cap of 5 keeps us well under this. A pathological loop pushing 200+ jobs/min would still take ≥1 hour of sustained traffic to approach the limit.
- **Cache key "ignore query string"** (page rule §3.1 of the ops doc) — `?utm_source=…` does not affect cache lookup, so query strings are stripped client-side before submission. Submitting `?utm_a` and `?utm_b` would otherwise waste two purge slots and result in a single hit.

**Token confidentiality:** the token is sent only to `api.cloudflare.com` over TLS and is **never** logged. The CDN client logs `clientEnabled` (boolean) + `zoneId` only. This is asserted in the unit suite (`expectNoTokenLeak`).

## Triggers

`invalidateEventCache(deps, event, reason)` is called from:

| Path                                              | Reason string             | Notes |
| ------------------------------------------------- | ------------------------- | ----- |
| `publishEvent`                                    | `event_publish`           | Always purge — moves event onto the public CDN. |
| `unpublishEvent`                                  | `event_unpublish`         | Always purge — removes event from the public CDN; stale 200s would be misleading. |
| `adminApproveEvent`                               | `admin_approve_publish`   | Same as `publishEvent` — admin-driven publish. |
| `adminRejectEvent`                                | `admin_reject_unpublish`  | New: defense-in-depth. An `under_review → draft` transition normally affects an event that was never on the edge, but a re-submitted event could have been previously published; a stale 200 would be misleading after rejection. |
| `updatePublishedEvent`                            | `published_event_patch`   | Hot-edit of a live event — pricing, title, description, etc. |
| `updateEventPolicies` (when `wasPublished && changedAnything`) | `event_policies_update` | Conditional: drafts are never on the CDN; if nothing changed, nothing to purge. |

The `replaceEventPricing`, `replaceEventCategories`, `updateEventCategoryCapacity` paths are draft-only (they reject non-draft status), so they do **not** invalidate the CDN — drafts are not on the public CDN by definition.

For each trigger we always include `/sitemap.xml` alongside the event detail URL, since publish/unpublish/policy edits change the sitemap and Cloudflare caches `/sitemap.xml` separately. (I-2.4.4 owns sitemap regeneration; this ticket only owns the edge purge.)

## File changes

| File                                                  | Change                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/lib/cdn-invalidation.ts` (new)          | `CdnPurgeConfig`, `CdnPurgeClient`, `createCdnPurgeClient`, `eventCacheUrls`, `organizerCacheUrls`, `sitemapCacheUrls`, `stripQueryString`, `MAX_URLS_PER_REQUEST = 30`. Best-effort: never throws. |
| `apps/api/src/queues/cdn-purge.ts` (new)              | `CdnPurgePayload`, `CDN_PURGE_QUEUE_NAME`, `CDN_PURGE_JOB_NAME`, `enqueueCdnPurge` (no-ops when queue undefined or empty payload), `createCdnPurgeWorker` (concurrency 5, structured `cdn_purge` log line). |
| `apps/api/src/lib/queue.ts`                           | Added `cdnPurge: "cdn-purge"` to `QUEUE_NAMES`; queue config (concurrency 5, attempts 3, exponential 5s); `cdnPurge: Queue` in `AppQueues`; instantiation in `createQueues`; close in `closeQueues`. |
| `apps/api/src/modules/events/service.ts`              | Imports added. `EventPublishDeps`, `EventPoliciesDeps`, `UpdatePublishedEventDeps` extended with `cdnPurgeQueue?: Queue<CdnPurgePayload>` + `cdnBaseUrl?: string`. `invalidateEventCache` rewritten — preserves the Redis `DEL` from I-2.4.3, adds the CDN enqueue, accepts a third `reason` argument. New call in `adminRejectEvent`. `updateEventPolicies` restructured to invalidate post-commit only when `wasPublished && changedAnything`. |
| `apps/api/src/modules/events/routes.ts`               | 4 deps blocks updated: `publishEvent`, `unpublishEvent`, `updateEventPolicies`, `updatePublishedEvent`. Pattern: `cdnPurgeQueue: app.queues.cdnPurge, ...(app.config.CDN_BASE_URL ? { cdnBaseUrl: app.config.CDN_BASE_URL } : {})`. |
| `apps/api/src/modules/admin/event-review-service.ts`  | Imports added. `AdminEventReviewDeps` extended with same two optional fields. The body of `approveEventReview`/`rejectEventReview` already spreads `deps` to the events service helpers — no body changes needed. |
| `apps/api/src/modules/admin/routes.ts`                | 2 deps blocks updated: `approveEventReview`, `rejectEventReview` (same pattern as events routes). |
| `apps/api/src/workers/index.ts`                       | Build a `CdnPurgeConfig` from env at boot, instantiate the client (no-op when disabled), register `createCdnPurgeWorker` in the worker array. The worker process re-derives `enabled` from env directly so it can start without invoking `loadConfig`. |
| `apps/api/test/lib/cdn-invalidation.test.ts` (new)    | 25 tests: enabled path (URL/headers/body shape, query-strip, dedup, chunking 35→2 batches, network/HTTP/envelope errors swallowed, token-leak guard); disabled paths (4 missing-config branches, all guarantee `fetch` not called); URL helper shape; init log shape. |
| `apps/api/test/queues/cdn-purge.test.ts` (new)        | 9 tests: constants; `enqueueCdnPurge` no-ops on undefined queue / empty payload / present-but-empty arrays; happy path forwards canonical job name; queue.add rejection swallowed and warn-logged; jobless add returns `null`; works without logger argument. |
| `apps/api/test/lib/queue.test.ts`                     | Updated counts (`6 → 8`, this ticket adds `cdnPurge`; I-2.4.4 separately added `sitemapRegen`); added cdn-purge config-shape assertion; updated `closeQueues` mock arity. |
| `docs/impl-plan/feature-2.4-I-2.4.2.md` (this file)   | Plan doc. |

## Retry & backoff

| Attempt | Delay before retry (ms)      |
| ------- | ---------------------------- |
| 1 fail  | ~5,000 (exponential base × 1) |
| 2 fail  | ~10,000 (exponential × 2)     |
| 3 fail  | DLQ via `failed-jobs` queue   |

Three attempts are sufficient for transient Cloudflare blips (5xx, 502 from edge maintenance) without overwhelming the rate limit. After the third attempt, the job lands in the shared `failed-jobs` DLQ for ops review (handled by the existing `createDLQHandler`). The DLQ row carries the original payload (URLs + reason + correlationId) so a manual replay or a manual `wrangler` purge is straightforward.

## Operational readiness

- **Logging:** the worker emits exactly one structured log line per job — `cdn_purge` with `success`, `urls`, `tags`, `reason`, `correlationId`, `jobId`, `attempt`, `durationMs`, `clientEnabled`. The CDN client emits an init line (`cdn_purge_client_ready` with `zoneId`, **never** the token) and `warn` lines on each failure (`cdn_purge_network_error`, `cdn_purge_http_error`, `cdn_purge_api_error`).
- **Secret handling:** `CLOUDFLARE_API_TOKEN` is read from env in two places — `loadConfig` (API process) and the worker bootstrap. Never logged. The unit suite's `expectNoTokenLeak` helper serializes every log entry and asserts the token does not appear.
- **Graceful degradation:** when `CLOUDFLARE_PURGE_ENABLED=false` or any credential is missing, the client is a no-op stub. The worker still runs, jobs are still consumed (so the queue does not back up), but every job is a debug-logged skip. This keeps the queue topology identical across enabled/disabled deployments and means an emergency disable (set `CLOUDFLARE_PURGE_ENABLED=false`, redeploy) doesn't leave jobs stuck.

## Validation

- `pnpm --filter api check-types` → 0 errors.
- `pnpm --filter api test` → **911 passed** (54 files; baseline 869 → +42 new tests, 0 regressions).
- Adversarial review (3 reviewers, see Anvil ledger) — all findings addressed.

## Future work (out of scope here)

- **Cache-Tag adoption.** The client already supports `purgeTags`, but our Cloudflare plan today doesn't include the Enterprise Cache-Tag header injection. When/if we move to Enterprise, a single tag like `event:<id>` lets us purge with O(1) API calls regardless of how many edge URLs are derived.
- **Organizer profile mutations.** The `organizerCacheUrls` helper is already wired but no organizer-mutation path calls `invalidateEventCache` today (the organizer service does not yet have an "invalidate" hook). When organizer profile editing lands, that path should call `enqueueCdnPurge` directly with `organizerCacheUrls(...)`.
- **Bulk admin actions.** A future "approve all queued events" admin tool could enqueue dozens of purge jobs at once. The 5-concurrency cap + 3-attempt retry already protects us from rate-limit triggers, but a batched-purge entrypoint that combines URLs into a single 30-URL job would be more efficient.
