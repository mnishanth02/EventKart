# I-0.4.2: Pino Structured Logging + OpenTelemetry Bridge

**Feature ID:** I-0.4.2
**Module:** 0.4 — Observability, Metrics & Error Infrastructure
**Scope:** Backend only (`apps/api`)
**Dependencies:** None (first in Module 0.4)
**Downstream:** I-0.4.5 (production metrics), I-0.4.6 (BullMQ observability)

---

## Requirements

### Functional
- **R1:** Structured JSON logs in production, human-readable pretty-print in development
- **R2:** `X-Request-ID` (correlation ID) included in every log line automatically
- **R3:** OpenTelemetry bridge — `trace_id` and `span_id` injected into Pino log lines when OTEL is active
- **R4:** OTEL SDK initializes before any instrumented module loads (HTTP, Fastify, Pino)
- **R5:** OTEL is opt-in — when `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, no traces are exported (noop)
- **R6:** Graceful OTEL shutdown on process exit

### Security (OWASP)
- **S1:** Redact sensitive fields from logs: `authorization`, `cookie`, `password`, `token`, `secret`, `otp`, `x-internal-key`
- **S2:** Never log request/response bodies by default (may contain PII)
- **S3:** Redact paths configurable for future extensions

### Performance
- **P1:** Pino async transport in production (non-blocking I/O)
- **P2:** OTEL adds < 5% overhead per request (standard for OTEL instrumentation)

---

## Dependencies to Install

### Production (`dependencies`)
| Package | Purpose |
|---------|---------|
| `@opentelemetry/sdk-node` | All-in-one OTEL SDK (includes api, resources, semantic-conventions) |
| `@opentelemetry/exporter-trace-otlp-http` | OTLP trace exporter over HTTP/protobuf |
| `@opentelemetry/instrumentation-http` | Auto-trace HTTP requests (creates spans) |
| `@opentelemetry/instrumentation-fastify` | Add Fastify route details to HTTP spans |
| `@opentelemetry/instrumentation-pino` | Inject trace_id/span_id into Pino log lines |

### Development (`devDependencies`)
| Package | Purpose |
|---------|---------|
| `pino-pretty` | Human-readable log output in development |

---

## Implementation Steps

### Task 1: Install dependencies [S]
- Run `pnpm --filter api add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/instrumentation-http @opentelemetry/instrumentation-fastify @opentelemetry/instrumentation-pino`
- Run `pnpm --filter api add -D pino-pretty`

### Task 2: Add OTEL config options [S]
**File:** `apps/api/src/lib/config.ts` [modify]

Add optional OTEL configuration fields to `appConfigSchema`:
```typescript
OTEL_SERVICE_NAME: Type.String({ default: "eventkart-api" }),
OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String()),
OTEL_EXPORTER_OTLP_HEADERS: Type.Optional(Type.String()),
```

**Why optional:** OTEL should be opt-in. In dev, no collector is running. In prod, Railway or another collector endpoint is configured.

### Task 3: Create OpenTelemetry SDK initialization [M]
**File:** `apps/api/src/lib/otel.ts` [new]

- Export `initTelemetry(config)` function that:
  1. Creates a `NodeSDK` instance with:
     - `resource`: service name from config
     - `traceExporter`: `OTLPTraceExporter` when endpoint is set, undefined otherwise
     - `instrumentations`: HTTP, Fastify, Pino instrumentations
  2. Calls `sdk.start()`
  3. Returns the SDK instance for shutdown
- Export `shutdownTelemetry(sdk)` for graceful shutdown
- When no endpoint configured: SDK still runs (instrumentations are active for log correlation) but no traces are exported

**Key detail:** OTEL SDK MUST be initialized before any instrumented module (`http`, `fastify`, `pino`) is imported. In `server.ts`, this means importing `otel.ts` as the very first line.

### Task 4: Create Pino logger factory [M]
**File:** `apps/api/src/lib/logger.ts` [new]

Export `createLoggerOptions(config)` that returns Pino options:
```typescript
{
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-internal-key']",
      "req.headers['set-cookie']",
      "password",
      "token",
      "secret",
      "otp",
      "creditCard",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      hostname: req.hostname,
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  formatters: {
    level: (label) => ({ level: label }),  // Use string labels not numbers
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Dev: use pino-pretty transport
  // Prod: default stdout (JSON)
  ...(isDev ? {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  } : {}),
}
```

### Task 5: Wire logger and OTEL into app [M]
**File:** `apps/api/src/server.ts` [modify]
- Import `otel.ts` as the FIRST import (before app.ts)
- Call `initTelemetry(config)` before `buildApp()`
- Register shutdown handler: `shutdownTelemetry(sdk)` on SIGTERM/SIGINT

**File:** `apps/api/src/app.ts` [modify]
- Import `createLoggerOptions` from `./lib/logger.js`
- Replace inline `{ level: config.LOG_LEVEL ?? "info" }` with `createLoggerOptions(config)`
- `options.logger` override still takes precedence (tests use `logger: false`)

**File:** `apps/api/.env.example` [modify]
- Add OTEL env vars with comments:
```
# OpenTelemetry (optional — enables distributed tracing)
# OTEL_SERVICE_NAME=eventkart-api
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=
```

### Task 6: Write tests [M]
**File:** `apps/api/test/lib/logger.test.ts` [new]
- Test `createLoggerOptions` returns correct structure
- Test level is set from config
- Test redaction paths are present
- Test dev mode includes pino-pretty transport
- Test prod mode does not include transport

**File:** `apps/api/test/lib/otel.test.ts` [new]
- Test `initTelemetry` succeeds with endpoint configured
- Test `initTelemetry` succeeds without endpoint (noop exporter)
- Test `shutdownTelemetry` doesn't throw

**File:** `apps/api/test/integration/request-correlation.test.ts` [new]
- Test that X-Request-ID header is echoed in response
- Test that request ID is present in request context
- Test that custom X-Request-ID from client is preserved

### Task 7: Validate [S]
- `pnpm --filter api check-types`
- `pnpm --filter api lint`
- `pnpm --filter api test`

---

## Files Summary

| File | Action | Workspace |
|------|--------|-----------|
| `apps/api/package.json` | [modify] — new deps | `apps/api` |
| `apps/api/src/lib/config.ts` | [modify] — OTEL config | `apps/api` |
| `apps/api/src/lib/otel.ts` | [new] — OTEL SDK init | `apps/api` |
| `apps/api/src/lib/logger.ts` | [new] — Pino logger factory | `apps/api` |
| `apps/api/src/app.ts` | [modify] — use logger factory | `apps/api` |
| `apps/api/src/server.ts` | [modify] — OTEL init first | `apps/api` |
| `apps/api/.env.example` | [modify] — OTEL env vars | `apps/api` |
| `apps/api/test/lib/logger.test.ts` | [new] — logger tests | `apps/api` |
| `apps/api/test/lib/otel.test.ts` | [new] — OTEL tests | `apps/api` |
| `apps/api/test/integration/request-correlation.test.ts` | [new] — correlation tests | `apps/api` |

---

## Completion Checklist
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Structured JSON logs in production | |
| 2 | Pretty-print logs in development | |
| 3 | X-Request-ID in every log line | |
| 4 | Sensitive fields redacted | |
| 5 | OTEL trace_id/span_id in logs when active | |
| 6 | OTEL graceful shutdown | |
| 7 | All existing tests still pass | |
| 8 | New tests for logger and OTEL | |
| 9 | check-types passes | |
| 10 | lint passes | |
