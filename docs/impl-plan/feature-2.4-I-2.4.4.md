# Feature 2.4 — I-2.4.4 sitemap.xml generation + serving

> Status: implemented (Wave B). See `apps/api/src/modules/sitemap/`,
> `apps/api/src/queues/sitemap-regen.ts`, and the cron + plugin wiring
> in `apps/api/src/plugins/queue.ts` + `apps/api/src/workers/index.ts`.

## 1. Goal

Serve a fresh, well-formed `https://eventkart.in/sitemap.xml` for
search engines covering:

- The homepage (`/`).
- Every published, future-dated event (`/events/<slug>`).
- Every verified organizer (`/organizers/<slug>`).

The generation MUST:

- Reflect publish/unpublish/admin-approve/published-edit and organizer
  approval transitions within ~one cron tick.
- Survive a brief origin/Redis outage thanks to defence-in-depth
  caching (Cloudflare edge + origin Redis + single-flight).
- Respect the sitemaps.org per-file 50,000 URL limit (defensive cap;
  V1 traffic is well under 1,000 URLs).

## 2. Architecture

```
                                                       ┌─────────────────┐
                                                       │ Cloudflare CDN  │
                                                       │  (1h TTL +      │
                                                       │  24h SWR; §3.3) │
                                                       └────────┬────────┘
                                                                │ miss
                                                                ▼
   ┌──────────────────────┐    publish/unpublish/      ┌─────────────────┐
   │ events/service.ts    │───enqueue (debounced)─────▶│ sitemap-regen   │
   │ admin/verification-  │                            │ BullMQ queue    │
   │ service.ts (approve) │                            └────────┬────────┘
   │ admin/event-review-  │                                     │
   │ service.ts           │                                     ▼
   └──────────────────────┘    cron `0 3 * * *` UTC    ┌─────────────────┐
                          ─────register on boot───────▶│ Worker: regen   │
                                                       │ XML, SETEX into │
                                                       │ Redis cache key │
                                                       └────────┬────────┘
                                                                │ JSON.stringify(xml)
                                                                ▼
   GET /api/v1/sitemap.xml ──singleFlight──┬─────▶ Redis cache:sitemap:current
                                           │
                                           └─producer (cache miss)─▶ buildSitemapXml
```

### 2.1 The three publish hooks

| Caller                                   | When                                         | What it enqueues |
| ---------------------------------------- | -------------------------------------------- | ---------------- |
| `events/service.ts::invalidateEventCache`| Every successful publish/unpublish/admin-approve/published-edit (called from `publishEvent`, `unpublishEvent`, `adminApproveEvent`, `adminRejectEvent`, `updateEventPolicies`, `updatePublishedEvent`) | Debounced regen with `reason: "event_publish_state_changed"` |
| `admin/verification-service.ts::approveOrganizer` | Razorpay enqueue block — only on approve (reject leaves an organizer that was already invisible) | Debounced regen with `reason: "organizer_verification_approved"` |
| `plugins/queue.ts` boot hook             | API process start                            | Cron repeatable `0 3 * * *` UTC, `reason: "cron"` |

All three callers share the same `jobId` =
`SITEMAP_REGEN_DEBOUNCE_JOB_ID`. BullMQ rejects duplicate jobIds while
a job is waiting/active — that's the debounce. A burst of 50 publish
clicks in one minute coalesces into one regen run. The cron is on a
**different** internal id (BullMQ's repeatable bookkeeping), so cron
ticks coexist with publish-driven regens.

### 2.2 Why JSON.stringify the XML

`apps/api/src/lib/cache-stampede.ts::singleFlight` was originally built
for JSON projections (events, organizers). It writes via
`redis.setex(key, ttlSec, JSON.stringify(value))` (line 200) and reads
via `JSON.parse(raw)` (line 85). The sitemap regen worker MUST follow
the same contract: writing the raw XML directly causes
`JSON.parse('<?xml…>')` to throw, the cached value silently degrades,
and every crawler hit falls through to the producer instead of the
cache.

This is a regression test in `routes.test.ts`. Caught by adversarial
review (gpt-5.3-codex) before commit.

## 3. Data model

V1 emits a flat `<urlset>` containing:

- 1 entry for the homepage. `lastmod = now()` because there's no
  stable timestamp for it.
- 1 entry per row from
  `SELECT slug, updatedAt, publishedAt, createdAt FROM events
   WHERE status = 'published' AND endAt > now()
   ORDER BY id LIMIT (50000 - 1)`.
  `lastmod = updatedAt ?? publishedAt ?? createdAt`. The defensive
  nullish chain protects against organic schema drift; in practice
  `updatedAt` is `$onUpdate(() => new Date())` so it's always set.
- 1 entry per row from
  `SELECT slug, updatedAt FROM organizers
   WHERE isVerified = true ORDER BY id LIMIT (remaining)`.

`ORDER BY id` produces byte-identical XML across regenerations when
nothing changed — the SETEX overwrites with the same bytes, no
unnecessary cache churn at the edge (Cloudflare uses ETag/If-None-Match
where supported).

Past events (`endAt <= now()`) are excluded — Google treats freshly
indexing dead events as low-quality. Their `/events/<slug>` pages
still resolve for users with bookmarks, just not for crawlers.

`<changefreq>daily</changefreq>` + `<priority>0.7</priority>` are
informational hints. Google ignores them; Bing and Yandex still honour
them.

## 4. Cache layers

| Layer | TTL | Owner | What it does |
|-------|-----|-------|--------------|
| Cloudflare edge | 1h `max-age` + 24h `stale-while-revalidate` | §3.3 cache rule | Absorbs crawler traffic, survives origin downtime up to ~25h |
| Redis cache key `cache:sitemap:current` | 25h SETEX | Worker | Origin-side cache. The 25h TTL gives a 1h safety margin over the 24h cron — a single missed run still serves a fresh sitemap |
| `singleFlight` lock | 30s lock TTL, 5s follower timeout | Route | Stampede guard for the cache miss path. Followers fail-OPEN at 5s rather than block a crawler request |

## 5. Failure modes & how they're handled

| Failure | Behaviour |
|---------|-----------|
| `CDN_BASE_URL` unset | `buildSitemapXml` warns and uses fallback `https://eventkart.in`. Sitemap still renders. |
| Redis down on cache GET | `singleFlight` bypasses cache and runs producer inline. |
| Redis down on cache SETEX (worker) | Job fails; BullMQ retries (2 attempts, 5s exponential backoff). After 2 failures DLQ'd. Stale XML serves until next cron tick. |
| BullMQ enqueue fails on publish | `invalidateEventCache` swallows + warn-logs. The cron still picks it up within 24h. |
| Cron registration fails on API boot | `plugins/queue.ts` warn-logs and continues. Publish-driven debounced enqueues still work — just no scheduled refresh. |
| URL count exceeds `SITEMAP_URL_LIMIT` (50,000) | Hard cap; no overflow. V2 work item: emit `<sitemapindex>` of segmented files. |
| Slug contains XML-special char | Defensive escape of all 5 XML chars (`& < > " '`). Slugs are normalised to `[a-z0-9-]` so this is paranoia, but it prevents a future env-var typo (e.g. `&` in `CDN_BASE_URL`) from poisoning the document. |

## 6. Testing

| File | What it covers |
|------|----------------|
| `apps/api/test/modules/sitemap/service.test.ts` | XML envelope, lastmod fallback chain, organizer rendering, fallback host warning, escape safety, URL limit constant. |
| `apps/api/test/modules/sitemap/routes.test.ts` | Headers (content-type, cache-control), public access (no auth), worker→route serialization contract regression. |
| `apps/api/test/queues/sitemap-regen.test.ts` | `enqueueSitemapRegen` no-op on undefined queue, debounce jobId, reason propagation, custom jobId override. `scheduleSitemapRegenCron` pattern + UTC tz, no jobId override. |
| `apps/api/test/lib/queue.test.ts` | Updated 6→7 queue assertions. New config block test for `sitemap-regen` (concurrency 1, attempts 2, exponential 5s). |
| `apps/api/test/plugins/queue.test.ts` | Updated 6→7 close count, new `sitemapRegen` property assertion. |

## 7. Future work (V2)

- **Segmented `<sitemapindex>`** when the URL count grows past
  ~30,000. Strategy: shard by `events` first-letter-of-slug, plus one
  organizers shard. Single nightly cron, but the worker writes 27
  cache keys (a-z + organizers) and the index points at all of them.
- **lastmod for the homepage** — today it's `now()`, which means the
  whole sitemap's mtime drifts every regen. Could be pinned to
  `MAX(events.updatedAt, organizers.updatedAt)` so unchanged data
  produces an unchanged sitemap.
- **Image sitemap** — once event images stabilise, emit
  `<image:image>` entries for the hero image of each event.
- **News sitemap** — for the `/blog/*` content surface (not yet
  shipped).

## 8. Operational notes

- **Cloudflare Origin Rule** — `eventkart.in/sitemap.xml` →
  `api.eventkart.in/api/v1/sitemap.xml`. See
  `docs/operations/cloudflare-cdn-setup.md` §3.7. **If the rule is
  removed, crawlers see a 404 from the SSR app.**
- **Manual regen** — `enqueueSitemapRegen(app.queues.sitemapRegen,
  { reason: "manual" })` from a one-off admin tool. The same debounce
  applies, so multiple admin clicks coalesce.
- **Inspecting the cache** — `redis-cli -n <db> GET cache:sitemap:current`
  returns the JSON-stringified XML.
- **Cron tuning** — `SITEMAP_REGEN_CRON_PATTERN` is
  `0 3 * * *` UTC. Override per-environment if `0 3 *` UTC collides
  with a maintenance window.
