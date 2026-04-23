# I-0.4.1 — Sentry Integration

**Feature:** Sentry error tracking — separate projects for API server and web app (client + SSR)
**Module:** 0.4 — Observability, Metrics & Error Infrastructure
**Depends on:** None (I-0.4.2 Pino logging is ✅ complete, beneficial but not required)
**Workspaces:** `apps/api`, `apps/web`

---

## Requirements

### Acceptance Criteria
- Sentry error tracking active on all three surfaces: API server, web client (browser), web SSR server
- Unhandled/unexpected errors (5xx) captured to Sentry with full stack traces
- Expected errors (4xx AppErrors) NOT sent to Sentry (noise reduction)
- X-Request-ID from Pino logging (I-0.4.2) attached to every Sentry error event
- PII scrubbed from error payloads (phone numbers, emails, passwords, tokens)
- Source maps uploaded for readable stack traces in production
- Graceful degradation: zero overhead when `SENTRY_DSN` / `VITE_SENTRY_DSN` not configured
- All existing tests continue passing

### Security Requirements
- `SENTRY_DSN` is public-safe (ok in VITE_* client env)
- `SENTRY_AUTH_TOKEN` is a secret (server-only, for source map upload in CI)
- `beforeSend` hook scrubs PII: phone numbers, email addresses, passwords, tokens, cookie values
- Reuse existing Pino redaction patterns for consistency

### Architecture Decisions
1. **Conditional OTEL**: When `SENTRY_DSN` is set, Sentry manages OpenTelemetry (it includes HTTP, Fastify, Pino instrumentations). When absent, existing `otel.ts` runs as before. Avoids dual-OTEL conflicts.
2. **2 Sentry projects**: `eventkart-api` (API server) and `eventkart-web` (browser + SSR). The `@sentry/tanstackstart-react` SDK uses a single DSN for both client and SSR.
3. **Packages**: `@sentry/node` for API, `@sentry/tanstackstart-react` for web.

---

## Implementation Steps

### Phase 1: API Server — Sentry Integration

| # | Task | File | Action | Complexity | Depends | Done |
|---|------|------|--------|------------|---------|------|
| 1 | Add SENTRY_* env vars to config schema | `apps/api/src/lib/config.ts` | modify | S | — | ✅ 2026-07-23 |
| 2 | Create Sentry initialization module | `apps/api/src/lib/sentry.ts` | new | M | 1 | ✅ 2026-07-23 |
| 3 | Make OTEL conditional on Sentry presence | `apps/api/src/lib/otel.ts` | modify | S | 2 | ✅ 2026-07-23 |
| 4 | Integrate Sentry into server startup | `apps/api/src/server.ts` | modify | S | 2, 3 | ✅ 2026-07-23 |
| 5 | Register Sentry handlers in app factory | `apps/api/src/app.ts` | modify | S | 2 | skipped (error-handler captures instead) |
| 6 | Capture unexpected errors in error-handler | `apps/api/src/plugins/error-handler.ts` | modify | S | 2 | ✅ 2026-07-23 |
| 7 | Add Sentry mock to test setup | `apps/api/test/setup.ts` | modify | S | — | ✅ 2026-07-23 |
| 8 | Write Sentry integration tests | `apps/api/test/integration/sentry.test.ts` | new | M | 7 | ✅ 2026-07-23 |
| 9 | Update .env.example | `apps/api/.env.example` | modify | S | 1 | ✅ 2026-07-23 |

### Phase 2: Web App — Sentry Integration (Client + SSR)

| # | Task | File | Action | Complexity | Depends | Done |
|---|------|------|--------|------------|---------|------|
| 10 | Add VITE_SENTRY_* env vars to public env | `apps/web/src/lib/env/public.ts` | modify | S | — | ✅ (pre-existing) |
| 11 | Add SENTRY_* server env vars | `apps/web/src/lib/env/server.ts` | modify | S | — | ✅ (pre-existing) |
| 12 | Create client-side Sentry initialization | `apps/web/src/integrations/sentry/client.ts` | new | M | 10 | ✅ 2026-07-23 |
| 13 | Create SSR server-side Sentry initialization | `apps/web/src/integrations/sentry/server.ts` | new | M | 11 | ✅ 2026-07-23 |
| 14 | Create server entry with Sentry wrapping | `apps/web/src/server.ts` | new | S | 13 | ✅ 2026-07-23 |
| 15 | Add sentryTanstackStart Vite plugin | `apps/web/vite.config.ts` | modify | S | — | ✅ 2026-07-23 |
| 16 | Integrate with error boundary | `apps/web/src/components/error/error-fallback.tsx` | modify | S | 12 | ✅ 2026-07-23 |
| 17 | Update .env.example | `apps/web/.env.example` | modify | S | 10, 11 | ✅ 2026-07-23 |

### Phase 3: Validation & Documentation

| # | Task | File | Action | Complexity | Depends | Done |
|---|------|------|--------|------------|---------|------|
| 18 | Install packages | `apps/api/package.json`, `apps/web/package.json` | modify | S | — | ✅ 2026-07-23 |
| 19 | Run check-types + lint + test for api | — | validate | S | 1-9 | ✅ 2026-07-23 (pre-existing drizzle-orm type errors, lint clean, 371/371 tests pass) |
| 20 | Run check-types + lint + test for web | — | validate | S | 10-17 | ✅ 2026-07-23 (types clean, lint clean, 75/75 tests pass) |
| 21 | Update progress.md + v1-implementation-plan.md | `progress.md`, `docs/v1-implementation-plan.md` | modify | S | 19, 20 | ✅ 2026-07-23 |

---

## API Server — Key Implementation Details

### Config (Task 1)
```typescript
// Add to appConfigSchema
SENTRY_DSN: Type.Optional(Type.String({ minLength: 1 })),
SENTRY_ENVIRONMENT: Type.Optional(Type.String({ minLength: 1 })),
SENTRY_RELEASE: Type.Optional(Type.String({ minLength: 1 })),
SENTRY_TRACES_SAMPLE_RATE: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
```

### Sentry Init (Task 2)
- `initSentry(config)` → initializes `@sentry/node` with `fastifyIntegration()`
- Returns boolean indicating whether Sentry is active
- `beforeSend` hook strips PII matching Pino redaction patterns
- Configures `release`, `environment`, `tracesSampleRate`
- Exports `setupFastifyErrorHandler(app)` for Fastify integration

### OTEL Conditional (Task 3)
- `initTelemetry(config)` checks if Sentry is managing OTEL (via `config.SENTRY_DSN`)
- If Sentry active: returns no-op SDK (Sentry handles OTEL)
- If Sentry absent: runs existing OTEL setup unchanged

### Error Handler (Task 6)
- Import `Sentry.captureException()` for 5xx errors only
- Attach `requestId` and `userId` to Sentry scope
- Skip capture for `AppError` instances (expected business errors)

---

## Web App — Key Implementation Details

### Client Init (Task 12)
```typescript
// apps/web/src/integrations/sentry/client.ts
import * as Sentry from "@sentry/tanstackstart-react";
// Browser-only init with BrowserTracing, Replay
```

### SSR Server Init (Task 13)
```typescript
// apps/web/src/integrations/sentry/server.ts
import * as Sentry from "@sentry/tanstackstart-react";
// Node.js SSR init
```

### Server Entry (Task 14)
```typescript
// apps/web/src/server.ts
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
```

### Vite Plugin (Task 15)
- Add `sentryTanstackStart()` as the LAST plugin in vite.config.ts
- Handles source map upload during production builds
- Remove the existing `external: [/^@sentry\//]` since the SDK is now a real dependency

---

## Testing Plan

### API Tests (`apps/api/test/integration/sentry.test.ts`)
| Test | Type |
|------|------|
| Sentry initializes when DSN is configured | Happy path |
| Sentry skips initialization when DSN is absent | Edge case |
| 500 errors are captured to Sentry | Happy path |
| AppError (4xx) instances NOT captured | Edge case |
| PII is scrubbed from error events via beforeSend | Security |
| X-Request-ID attached to error scope | Integration |

---

## Files Summary

### apps/api
| File | Action |
|------|--------|
| `src/lib/config.ts` | modify — add SENTRY_* env vars |
| `src/lib/sentry.ts` | **new** — Sentry init + PII scrubbing + Fastify setup |
| `src/lib/otel.ts` | modify — conditional on Sentry presence |
| `src/server.ts` | modify — import Sentry before OTEL |
| `src/app.ts` | modify — register Sentry error handler |
| `src/plugins/error-handler.ts` | modify — capture unexpected errors |
| `test/setup.ts` | modify — mock @sentry/node |
| `test/integration/sentry.test.ts` | **new** — integration tests |
| `.env.example` | modify — add SENTRY_* vars |
| `package.json` | modify — add @sentry/node |

### apps/web
| File | Action |
|------|--------|
| `src/lib/env/public.ts` | modify — add VITE_SENTRY_* vars |
| `src/lib/env/server.ts` | modify — add SENTRY_* server vars |
| `src/integrations/sentry/client.ts` | **new** — browser Sentry init |
| `src/integrations/sentry/server.ts` | **new** — SSR server Sentry init |
| `src/server.ts` | **new** — server entry with Sentry wrapping |
| `vite.config.ts` | modify — add sentryTanstackStart plugin |
| `src/components/error/error-fallback.tsx` | modify — capture errors to Sentry |
| `.env.example` | modify — add SENTRY_* vars |
| `package.json` | modify — add @sentry/tanstackstart-react |
