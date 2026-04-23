# I-0.4.6 — BullMQ Observability

**Module:** 0.4 — Observability, Metrics & Error Infrastructure
**Scope:** Backend only (`apps/api`)
**Dependencies:** I-0.4.2 (Pino/OTEL foundation), I-0.1.6 (BullMQ infrastructure), I-0.4.5 (metrics emitter)

---

## Requirements

Per v1-implementation-plan: "queue depth, oldest job age, retry count, DLQ count per queue"

- ✅ Queue depth (waiting + active) per queue
- ✅ Oldest job age (seconds) per queue
- ✅ Delayed/retry jobs per queue (backoff count)
- ✅ Failed jobs per queue
- ✅ DLQ total depth

## Design Decisions

- **Polling-based** — API process has Queue producers, not Workers. Uses `Queue.getJobCounts()` and `Queue.getJobs()` via 30s polling (same pattern as Redis INFO polling from I-0.4.5).
- **No native OTEL** — BullMQ v5.76 does NOT export native OpenTelemetry instrumentation despite plan reference to v5.71+. Manual implementation via Queue API.
- **Per-queue labels** — All gauges labeled with `{queue: name}` for dashboard filtering.
- **DLQ total only** — Per-original-queue DLQ breakdown would require scanning all DLQ job data. Total DLQ depth reported instead.
- **Domain queues only** — Polls payment-webhook, email, cleanup, exports. DLQ queue polled only for its total count.

## Implementation

### Instruments Added (metrics.ts)

| Instrument | Type | Description |
|---|---|---|
| `queue.depth` | ObservableGauge | Waiting + active jobs per queue (existing, now wired) |
| `queue.oldest_job_age` | ObservableGauge | Age of oldest waiting job in seconds (existing, now wired) |
| `queue.delayed_jobs` | ObservableGauge | NEW — delayed/retry jobs per queue |
| `queue.failed_jobs` | ObservableGauge | NEW — failed jobs per queue |
| `queue.dlq.depth` | ObservableGauge | NEW — total dead-letter queue depth |

### Metrics Plugin Changes (plugins/metrics.ts)

- Added `queue` as plugin dependency (alongside `redis`)
- Added queue polling (30s interval) parallel to Redis polling
- Iterates 4 domain queues calling `getJobCounts("waiting", "active", "delayed", "failed")`
- For oldest job age: calls `getJobs(["waiting"], 0, 0)` when waiting > 0
- DLQ depth: polls `failedJobs.getJobCounts("waiting", "active")`
- Cached stats read by observable gauge callbacks (sync)
- Graceful error handling — poll failures logged at debug level, never break the app

### Test Mock Updates

- `MockQueue` in `test/setup.ts`: added `getJobs` method + `delayed` field in `getJobCounts`
- `test/plugins/queue.test.ts`: added `getJobCounts`/`getJobs` to local mock
- `test/plugins/metrics.test.ts`: added local bullmq mock with realistic counts + 3 new tests

### Task Table

| # | Task | Status | Completed |
|---|------|--------|-----------|
| 1 | Add queue metric instruments to metrics.ts | ✅ | 2026-04-23 |
| 2 | Add queue polling to plugins/metrics.ts | ✅ | 2026-04-23 |
| 3 | Update test mocks + add queue metrics tests | ✅ | 2026-04-23 |
| 4 | Validate: check-types + lint + test (403 tests passing) | ✅ | 2026-04-23 |

### Files Summary

**Modified files:**
- `apps/api/src/lib/metrics.ts` — Added 3 new ObservableGauge instruments, updated section comment
- `apps/api/src/plugins/metrics.ts` — Added queue polling (30s), observable callbacks, `queue` dependency
- `apps/api/test/setup.ts` — Added `getJobs` + `delayed` to MockQueue
- `apps/api/test/plugins/metrics.test.ts` — Added local bullmq mock, 3 new tests (7 total)
- `apps/api/test/plugins/queue.test.ts` — Added `getJobCounts`/`getJobs` to local mock
- `apps/api/test/lib/metrics.test.ts` — Updated queue instrument assertions (new instruments)

### Known Limitations

1. **Worker-side metrics** — Job processing duration, stalled job detection, and per-job completion/failure counters require Worker event hooks. Workers run as a separate Railway service; adding OTEL to workers is a future enhancement.
2. **DLQ per-queue breakdown** — DLQ reports total depth only. Per-original-queue counts would require scanning all DLQ job data.
3. **Oldest job age resolution** — `getJobs(["waiting"], 0, 0)` may not return the chronologically oldest job in all Redis configurations (depends on list ordering). Sufficient for alerting on job staleness.
