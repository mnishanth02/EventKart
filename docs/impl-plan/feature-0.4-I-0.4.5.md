# I-0.4.5 — Production Metrics Emitter

**Module:** 0.4 — Observability, Metrics & Error Infrastructure
**Scope:** Backend only (`apps/api`)
**Dependencies:** I-0.4.2 (Pino/OTEL foundation), I-0.1.5 (Redis)
**Downstream:** I-0.4.6 (BullMQ observability)

---

## Requirements

Per architecture §4.3, track these from day one:

- ✅ HTTP request RPS / p95 / p99 latency
- ✅ OTP success/failure/rate-limit metrics
- ✅ Conversion funnel: page view → OTP sent → OTP verified → booking created → payment confirmed
- ✅ Redis memory usage, eviction count, connected clients
- 🔮 Booking submit RPS / latency (instruments defined, wired when module built)
- 🔮 Payment order creation latency/error rate (instruments defined, wired when module built)
- 🔮 Webhook ACK latency, processing lag (instruments defined, wired when module built)
- 🔮 Queue depth, oldest job age (instruments defined, I-0.4.6 expands)
- 🔮 Email provider throttle/failure metrics (instruments defined, wired when module built)
- ⚠️ DB pool wait time — postgres.js does not expose pool stats; requires PgBouncer instrumentation
- ⏭️ CDN hit ratio — Cloudflare's responsibility, not API-side

## Implementation

### Packages Added
- `@opentelemetry/api` — Direct dependency for meter/instrument creation
- `@opentelemetry/sdk-metrics` — MeterProvider, PeriodicExportingMetricReader
- `@opentelemetry/exporter-metrics-otlp-http` — OTLP HTTP metrics exporter
- `@opentelemetry/resources` — Shared Resource with service.name

### Configuration
- `OTEL_METRICS_EXPORT_INTERVAL_MS` — Optional, default 60000ms (1-300000)
- Reuses existing `OTEL_EXPORTER_OTLP_ENDPOINT` for metrics export

### Architecture

1. **`lib/otel.ts`** — Updated `initTelemetry()` returns `TelemetryHandle { sdk, meterProvider }`.
   - When Sentry manages tracing: creates standalone MeterProvider with shared Resource
   - When no Sentry: includes metricReader in NodeSDK
   - Both paths share `service.name` via `resourceFromAttributes()`

2. **`lib/metrics.ts`** — Central instrument registry using `@opentelemetry/api` getMeter.
   - All instruments defined at module level (safe due to dynamic import in server.ts)
   - Instruments are no-ops when no MeterProvider configured
   - Explicit histogram bucket boundaries for latency percentiles

3. **`plugins/metrics.ts`** — Fastify plugin (depends on "redis")
   - HTTP metrics via `onResponse` hook (duration histogram + request counter)
   - Uses Fastify route template (`request.routeOptions.url`) to avoid cardinality explosion
   - Redis INFO polling every 30s → cached stats for observable gauge callbacks
   - Clean interval cleanup on close

4. **Auth service wiring** — OTP and funnel metrics
   - `sendOtpForPhone`: increments `otpSendTotal{status}` + `funnelStepTotal{step=otp_sent}`
   - `verifyOtpAndCreateSession`: increments `otpVerifyTotal{status}` + `funnelStepTotal{step=otp_verified}`

### Task Table

| # | Task | Status | Completed |
|---|------|--------|-----------|
| 1 | Install OTEL metrics packages | ✅ | 2026-04-23 |
| 2 | Add OTEL_METRICS_EXPORT_INTERVAL_MS to config | ✅ | 2026-04-23 |
| 3 | Update otel.ts with MeterProvider + metric reader | ✅ | 2026-04-23 |
| 4 | Create lib/metrics.ts instrument registry | ✅ | 2026-04-23 |
| 5 | Create plugins/metrics.ts (HTTP + Redis metrics) | ✅ | 2026-04-23 |
| 6 | Register metrics plugin in app.ts | ✅ | 2026-04-23 |
| 7 | Wire OTP + funnel metrics in auth service | ✅ | 2026-04-23 |
| 8 | Update test setup with OTEL API mock | ✅ | 2026-04-23 |
| 9 | Update otel.test.ts + sentry.test.ts for new API | ✅ | 2026-04-23 |
| 10 | Write metrics lib + plugin tests | ✅ | 2026-04-23 |
| 11 | Validate: check-types + lint + test (400 tests passing) | ✅ | 2026-04-23 |

### Files Summary

**New files:**
- `apps/api/src/lib/metrics.ts` [new] — Central metric instrument registry
- `apps/api/src/plugins/metrics.ts` [new] — HTTP + Redis metrics Fastify plugin
- `apps/api/test/lib/metrics.test.ts` [new] — 11 tests for instrument registry
- `apps/api/test/plugins/metrics.test.ts` [new] — 4 tests for metrics plugin

**Modified files:**
- `apps/api/src/lib/otel.ts` [modify] — MeterProvider, PeriodicExportingMetricReader, shared Resource
- `apps/api/src/lib/config.ts` [modify] — OTEL_METRICS_EXPORT_INTERVAL_MS config var
- `apps/api/src/server.ts` [modify] — TelemetryHandle return type
- `apps/api/src/app.ts` [modify] — Register metrics plugin
- `apps/api/src/modules/auth/service.ts` [modify] — OTP + funnel metric emissions
- `apps/api/test/setup.ts` [modify] — @opentelemetry/api mock + Redis info() mock
- `apps/api/test/lib/otel.test.ts` [modify] — Updated for TelemetryHandle API
- `apps/api/test/integration/sentry.test.ts` [modify] — Updated for TelemetryHandle API
- `apps/api/package.json` [modify] — New OTEL dependencies

### Known Limitations

1. **DB pool metrics** — postgres.js doesn't expose pool wait time or connection stats. Requires PgBouncer-level instrumentation or switching to `pg` driver.
2. **Redis command latency** — INFO polling provides server-level stats but not per-command client-side latency. Would require wrapping ioredis commands.
3. **Per-instance Redis gauges** — Multiple API pods each poll the same Redis instance. Dashboards should deduplicate using the `service.instance.id` resource attribute.
4. **Business metrics** — Booking, payment, webhook, queue, and email instruments are defined but not wired. Will be connected as those modules are implemented.
