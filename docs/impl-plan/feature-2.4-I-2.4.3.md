# I-2.4.3 — Cache Stampede Prevention (single-flight + Redis locking)

**Feature ID:** I-2.4.3
**Module:** 2.4 — Public CDN, SEO, and Caching
**Status:** In progress
**Dependencies:** I-2.4.1 (CDN setup, satisfied conceptually via CDN headers from `apps/web`), I-0.1.5 (Redis namespaced clients, complete).
**Coexists with:** I-2.4.2 — `invalidateEventCache` stub remains the integration point and the `TODO(I-2.4.2)` marker is preserved.

## Problem

Public event/organizer detail pages are SSR'd and cached at the Cloudflare edge with `s-maxage=60, stale-while-revalidate=300` (see `tanstack-start.instructions.md` §"Caching"). On expiry of a popular event's cache entry, dozens of edge POPs can fan out to the origin simultaneously, each performing the full DB projection (`selectEventBySlug` + organizer summary + categories + pricing + image rows + S3 presign). This is the classic cache stampede: a single cache miss multiplies into N concurrent expensive lookups.

## Approach

Add an origin-side **second-level cache** in Redis (`cache:` namespace) protected by a **per-key Redis lock** (single-flight). The first request through the gate (the *leader*) executes the producer and writes the result; concurrent requests (*followers*) poll the cache key and pick up the leader's value, falling back to running the producer themselves only if the leader is taking too long (so a crashed leader does not stall every request).

This sits *between* the Cloudflare edge cache (60s) and the origin DB. TTLs match: 60s for both the API single-flight cache and the CDN `s-maxage`. Cache invalidation on publish/unpublish flows through the existing `invalidateEventCache(_event)` stub — I-2.4.2 will later add Cloudflare API purge alongside the Redis `DEL`.

### Why not memoize in-process?

A single Railway API instance handles requests; in-process memoization would survive only inside one Node process. Redis-backed single-flight extends the protection across all API replicas (current pilot is single-instance, but we plan to scale and the contract should be replica-safe from day one).

## Lock semantics & edge cases

| Scenario                         | Behavior                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache hit                        | Return parsed JSON immediately. No lock attempted.                                                                                                                                                                  |
| Cache miss → leader              | `SET lock:<key> <token> NX PX 10000` succeeds. Run producer, `SETEX cache:<key> ttlSec <json>`, release lock via Lua `compare-and-delete` so we only delete *our* token (defensive against TTL expiry).             |
| Cache miss → follower            | Lock acquire returns `null`. Poll `cache:<key>` every `pollIntervalMs` (default 50ms) for up to `lockTimeoutMs` (default 2000ms). On hit → return. On timeout → fail-OPEN: run producer locally **without writing**. |
| Producer throws                  | Leader: release lock, propagate. Errors are NEVER cached.                                                                                                                                                           |
| Redis unavailable (GET error)    | Log `warn` once, bypass single-flight entirely (run producer directly, no cache attempt).                                                                                                                           |
| Crashed leader (lock outlives request) | Followers fail-open after `lockTimeoutMs`; lock TTL (10s) eventually frees the key for the next leader.                                                                                                       |
| Stale token (lock expired between SETNX and producer finish) | Lua compare-and-delete is a no-op; the next leader can take the lock. We never `DEL` somebody else's lock.                                                                  |

### Failure modes deliberately accepted

* **Followers may double-execute on timeout.** This is by design — it caps tail latency. Worst case: ~N producers run for ~lockTimeoutMs; without the fail-open, a crashed leader would stall every request for the full lock TTL (10s).
* **Cached `null` for invalid slugs.** When `selectEventBySlug` returns nothing, we cache `null` for 60s before falling through to the redirect lookup. This is acceptable because (a) the redirect lookup still runs each time so legitimate redirects work, and (b) it bounds the DB load from invalid-slug spam.
* **Follower-on-timeout never writes.** Otherwise N late writers would stomp on each other and possibly overwrite a freshly-written leader value.

## File changes

| File                                                   | Change                                                                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/lib/cache-stampede.ts` (new)             | Export `singleFlight<T>`, `invalidatePublicEventCache(redis, slug)`, `invalidatePublicOrganizerCache(redis, slug)` plus key-builder constants.                                                                |
| `apps/api/src/modules/events/public-detail-service.ts` | Add `cache?: Redis` to `PublicEventDetailDeps`. Wrap the success branch (`selectEventBySlug` + `buildPublicEventDetail`) in `singleFlight` keyed `evt:slug:<slug>` TTL 60s. Redirect branch unchanged. Cache value is `EventPublicDetail \| null`.  |
| `apps/api/src/modules/organizer/public-profile-service.ts` | Add `cache?: Redis` parameter. Wrap the `selectOrganizerBySlug` + projection in `singleFlight` keyed `org:slug:<slug>` TTL 60s. Redirect branch unchanged. Cache value is `OrganizerPublicProfile \| null`.    |
| `apps/api/src/modules/events/routes.ts`                | Pass `cache: app.redis.cache` into `lookupPublicEventBySlug` and `lookupPublicOrganizerBySlug`.                                                                                                                |
| `apps/api/src/modules/organizer/routes.ts`             | Pass `cache: app.redis.cache` into `lookupPublicOrganizerBySlug`.                                                                                                                                              |
| `apps/api/src/modules/events/service.ts`               | `invalidateEventCache` becomes `invalidateEventCache(deps, event)` where `deps: { cache?: Redis; log }`. Body: fire-and-forget `invalidatePublicEventCache(deps.cache, event.slug)` + preserved `TODO(I-2.4.2)` marker. `EventPublishDeps` and the published-edit deps interface gain `cache?: Redis`. Routes pass `cache: app.redis.cache` to those deps. Publish/unpublish/admin-approve/update-published bodies unchanged except for the deps signature. |
| `apps/api/test/lib/cache-stampede.test.ts` (new)       | Unit suite: cache hit; leader writes; concurrent followers reuse leader's value; lock-timeout fail-open (no double-write); producer error releases lock; Redis-unavailable bypass.                            |
| `apps/api/test/modules/events/public-detail.test.ts`   | Add integration test: 2 parallel `lookupPublicEventBySlug` calls share one DB lookup (producer ran once).                                                                                                      |
| `docs/impl-plan/feature-2.4-I-2.4.3.md` (this file)    | Plan doc.                                                                                                                                                                                                      |

## API surface

```ts
export interface SingleFlightOptions {
  lockTtlMs?: number;        // default 10_000
  pollIntervalMs?: number;   // default 50
  lockTimeoutMs?: number;    // default 2_000
}

export function singleFlight<T>(
  redis: Redis,
  key: string,                       // bare key, e.g. "evt:slug:foo"
  ttlSec: number,
  producer: () => Promise<T>,
  opts?: SingleFlightOptions,
): Promise<T>;

export function invalidatePublicEventCache(redis: Redis, slug: string): Promise<number>;
export function invalidatePublicOrganizerCache(redis: Redis, slug: string): Promise<number>;
```

`redis` is the namespaced cache client (`app.redis.cache`) — its `keyPrefix: "cache:"` is added automatically, so the effective Redis keys become `cache:evt:slug:foo` and `cache:lock:evt:slug:foo`.

## Test plan

### Unit (`apps/api/test/lib/cache-stampede.test.ts`)

1. **Cache hit short-circuit** — `GET` returns serialized value → producer never invoked, parsed value returned.
2. **Leader executes producer + writes** — `GET` null, `SET NX` succeeds → producer called once, `SETEX` called with TTL + serialized value, lock released via `EVAL` with token.
3. **Concurrent followers reuse leader's value** — 1 leader + 4 followers in parallel; backing Redis is an in-memory FakeRedis. After `Promise.all`, producer is called exactly once; all 5 callers receive the same value.
4. **Lock timeout fail-open** — Leader acquires lock but never writes (simulated stuck producer); follower polls until `lockTimeoutMs`, then runs its own producer; `SETEX` is NOT called by the follower path.
5. **Producer error releases lock** — Producer throws → `EVAL` (release) is called; cache is NOT written; error propagates.
6. **Redis unavailable bypass** — `GET` rejects → producer runs directly, no lock/set/eval calls happen.

### Integration (`public-detail.test.ts`)

* Two parallel `app.inject` GETs for the same slug with a shared mocked DB (single-row queue) and a FakeRedis. Assert: DB `select` is called the expected number of times for ONE projection (not two).

### Validation commands

```sh
pnpm --filter api check-types
pnpm --filter api test
```

## Rollback

Pure additive change for the cache layer. Rollback paths:

1. Drop `cache?: Redis` from the affected deps types and remove the `singleFlight` wrappers — services revert to direct DB lookups.
2. Restore `invalidateEventCache` to a no-op stub (still preserves the `TODO(I-2.4.2)` marker).
3. Delete `apps/api/src/lib/cache-stampede.ts` and the new test file.

No DB migrations, no schema changes, no auth surface changes. Single `git revert` covers it.

## Risks

| Risk                                               | Mitigation                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Stale public detail served for up to 60s after edits | Matches existing CDN `s-maxage=60` window; invalidation hook clears Redis on publish/unpublish.                    |
| Lock leaked after Redis restart                    | Lock has `PX 10000` TTL; even if Lua release fails, key auto-expires.                                              |
| JSON serialization of Date fields                  | All Date fields in projections already converted to ISO strings before parse; cached value is JSON-safe.            |
| Cache poisoning via response schema drift          | Cache writes go through projection schemas (`*.parse`); response schemas at the route boundary re-validate.        |
| Signed image URL expires inside cache window       | S3 presign TTL is 3600s; cache TTL is 60s. URL outlives every cached snapshot by ≥58 minutes.                       |

## Validation evidence

All gates green. Recorded in `anvil_checks` ledger (task_id `I-2.4.3`).

### Baseline (pre-implementation)

| Check       | Command                          | Result | Detail                                       |
| ----------- | -------------------------------- | ------ | -------------------------------------------- |
| check-types | `pnpm --filter api check-types`  | ✅ 0   | `tsc --noEmit` clean                         |
| tests       | `pnpm --filter api test`         | ✅ 0   | 50 files / 852 tests passed                  |

### After implementation (round 2 — post-reviewer fixes)

| Check                         | Command                                                              | Result | Detail                                                    |
| ----------------------------- | -------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| check-types                   | `pnpm --filter api check-types`                                      | ✅ 0   | `tsc --noEmit` clean                                      |
| tests (full suite)            | `pnpm --filter api test`                                             | ✅ 0   | 51 files / **869 tests passed** (Δ + 17 vs baseline)      |
| unit (cache-stampede focused) | `pnpm --filter api exec vitest run test/lib/cache-stampede.test.ts`  | ✅ 0   | 9/9 passed — incl. null-follower regression               |

### Adversarial review

Single reviewer (Medium task, no 🔴 files): `code-review` subagent on `gpt-5.3-codex`.

| Issue (reviewer-identified)                                                       | Severity | Resolution                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public event by-slug route never enables Redis single-flight (deps lacked `cache`). | HIGH     | **Fixed** — added `cache: app.redis.cache` to `apps/api/src/modules/events/routes.ts:270`. Test infra (default ioredis mock from `test/setup.ts`) keeps existing tests green.     |
| Organizer by-slug route called `lookupPublicOrganizerBySlug` with only 3 args.     | HIGH     | **Fixed** — added 4th-arg `app.redis.cache` at `apps/api/src/modules/organizer/routes.ts:98`.                                                                                       |
| `waitForLeader` returned `T \| null`; cached `null` defeated follower dedupe.       | HIGH     | **Fixed** — `waitForLeader` now returns a discriminated `{ hit: true; value: T } \| { hit: false }`. Added regression test `treats cached "null" as a hit` (#3 above).             |
| Read/write race: an in-flight reader could `SETEX` stale data after invalidation. | MEDIUM   | **Accepted** — bounded by `PUBLIC_EVENT_CACHE_TTL_SEC = 60`. Plan doc §"Failure modes deliberately accepted" already documents this; matches the SSR `s-maxage=60` window. Future hardening (versioned keys) deferred. |

Round 2 re-ran check-types + full test suite to confirm the three fixes
introduced no regressions. No further reviewer round was triggered (per
Anvil rules: max 2 rounds; round 2 was clean).

### Confidence

**High.** All static checks clean, all 869 tests passing, the reviewer's
three high-severity findings were valid and fixed under verification,
and the only remaining accepted issue (post-invalidation race) is
explicitly documented in the plan as a deliberate trade-off bounded by
the 60s TTL.
