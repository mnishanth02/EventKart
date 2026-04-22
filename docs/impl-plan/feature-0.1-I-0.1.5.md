# I-0.1.5 — Redis Client Setup (Namespaced Connections)

> Module 0.1: Shared Packages & Database Foundation
> Maps to: — (new, architecture requirement)

## Overview

Set up the ioredis-based Redis client for the Fastify API with namespaced connections using key prefixes. Each namespace (`sess:`, `bull:`, `rl:`, `cache:`, `otp:`) gets its own ioredis instance with `keyPrefix` to ensure cache eviction (volatile-lru) never touches sessions or queues.

## Prerequisites

| ID | Feature | Status |
|---|---|---|
| I-0.1.4 | Docker Compose (PostgreSQL + Redis) | ✅ Complete |

Redis 7 is available via Docker Compose at `redis://localhost:6379` with `volatile-lru` eviction and 256MB max memory.

## Requirements

### Functional
- Provide namespaced Redis clients for: sessions (`sess:`), BullMQ (`bull:`), rate limiting (`rl:`), caching (`cache:`), OTP (`otp:`)
- Each namespace uses ioredis `keyPrefix` for automatic key isolation
- A base client (no prefix) for health checks and raw operations
- A connection factory for BullMQ (which manages its own prefix via Queue/Worker constructor)
- Graceful shutdown: all connections closed on Fastify `onClose`
- `REDIS_URL` validated as part of app config

### Non-Functional
- Connection retry with exponential backoff (capped at 2s)
- Offline command queue enabled (commands buffered during reconnection)
- Lazy connect disabled (connect eagerly on plugin registration for fail-fast)
- Health check via `PING` command on base client

### Security
- No credentials logged (ioredis masks passwords in connection strings by default)
- `REDIS_URL` is a server-only env var — never exposed to the frontend

## New Dependency

| Package | Version | Why |
|---|---|---|
| `ioredis` | `^5` | Full-featured Redis client; required by BullMQ (I-0.1.6). Supports `keyPrefix`, streams, pipelines, Lua scripting. |

## Implementation Tasks

| # | Task | File(s) | Complexity | Status |
|---|------|---------|------------|--------|
| 1 | Install `ioredis` + `@types/ioredis` | `apps/api/package.json` | S | ✅ 2026-04-22 |
| 2 | Add `REDIS_URL` to config schema | `apps/api/src/lib/config.ts` [modify] | S | ✅ 2026-04-22 |
| 3 | Create Redis client library | `apps/api/src/lib/redis.ts` [new] | M | ✅ 2026-04-22 |
| 4 | Create Redis Fastify plugin | `apps/api/src/plugins/redis.ts` [new] | S | ✅ 2026-04-22 |
| 5 | Update Fastify type declarations | `apps/api/src/types/fastify.d.ts` [modify] | S | ✅ 2026-04-22 |
| 6 | Register Redis plugin in app factory | `apps/api/src/app.ts` [modify] | S | ✅ 2026-04-22 |
| 7 | Update test helper with REDIS_URL | `apps/api/test/helpers/build-app.ts` [modify] | S | ✅ 2026-04-22 |
| 8 | Create Redis lib unit tests | `apps/api/test/lib/redis.test.ts` [new] | M | ✅ 2026-04-22 |
| 9 | Create Redis plugin integration test | `apps/api/test/plugins/redis.test.ts` [new] | M | ✅ 2026-04-22 |
| 10 | Validate check-types + lint + test | — | S | ✅ 2026-04-22 |

## Detailed Design

### Task 2: Config Schema Update

Add `REDIS_URL` to `appConfigSchema` in `apps/api/src/lib/config.ts`:

```typescript
REDIS_URL: Type.String({ default: "redis://localhost:6379" }),
```

Update `AppConfig` type automatically via `Static<typeof appConfigSchema>`.

### Task 3: Redis Client Library (`apps/api/src/lib/redis.ts`)

```typescript
// Namespace key prefixes matching architecture spec
export const REDIS_NAMESPACES = {
  session: "sess:",
  bull: "bull:",
  rateLimit: "rl:",
  cache: "cache:",
  otp: "otp:",
} as const;

export type RedisNamespace = keyof typeof REDIS_NAMESPACES;

// Typed client container
export interface RedisClients {
  base: Redis;       // No prefix — health checks, raw ops
  session: Redis;    // sess: prefix
  rateLimit: Redis;  // rl: prefix
  cache: Redis;      // cache: prefix
  otp: Redis;        // otp: prefix
}

// Factory: creates a single ioredis client with common options
export function createRedisClient(url: string, options?: { keyPrefix?: string; lazyConnect?: boolean }): Redis;

// Factory: creates all namespaced clients
export function createRedisClients(url: string): RedisClients;

// Factory: creates a raw connection for BullMQ (no keyPrefix — BullMQ uses its own prefix)
export function createBullMQConnection(url: string): Redis;

// Graceful shutdown — quits all clients
export async function closeRedisClients(clients: RedisClients): Promise<void>;
```

**Key implementation details:**
- `maxRetriesPerRequest: null` — allows BullMQ-compatible infinite retries (BullMQ requires this)
- `retryStrategy`: exponential backoff capped at 2000ms
- `enableOfflineQueue: true` — buffer commands during reconnection
- `lazyConnect: false` by default — fail fast at startup

### Task 4: Redis Fastify Plugin (`apps/api/src/plugins/redis.ts`)

```typescript
// Uses fastify-plugin for encapsulation
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const clients = createRedisClients(fastify.config.REDIS_URL);

  // Verify connectivity at startup
  await clients.base.ping();

  fastify.decorate("redis", clients);

  fastify.addHook("onClose", async () => {
    fastify.log.info("Closing Redis connections");
    await closeRedisClients(clients);
  });
};
```

### Task 5: Type Declarations

Add to `apps/api/src/types/fastify.d.ts`:

```typescript
import type { RedisClients } from "../lib/redis.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    redis: RedisClients;
  }
}
```

### Task 6: App Factory Update

Register `redisPlugin` after `configPlugin` in `apps/api/src/app.ts`:

```typescript
app.register(configPlugin, { config });
app.register(redisPlugin);  // <-- new
app.register(corsPlugin);
```

## Testing Plan

### Unit Tests (`apps/api/test/lib/redis.test.ts`)

Tests use **mocked ioredis** (vi.mock) — no running Redis needed:

| Test | What it validates |
|---|---|
| `createRedisClient` applies keyPrefix | Verifies keyPrefix option is passed to constructor |
| `createRedisClient` uses correct retry strategy | Verifies exponential backoff capping |
| `createRedisClients` returns all namespaces | Verifies all 5 clients (base, session, rateLimit, cache, otp) |
| `createRedisClients` base has no prefix | base client created without keyPrefix |
| `createBullMQConnection` has no keyPrefix | Connection suitable for BullMQ |
| `createBullMQConnection` sets maxRetriesPerRequest null | BullMQ compatibility requirement |
| `closeRedisClients` calls quit on all clients | All 5 clients have quit() called |
| `closeRedisClients` tolerates quit() rejection | Uses allSettled, doesn't throw |
| `REDIS_NAMESPACES` matches architecture spec | Prefix values match `sess:`, `bull:`, `rl:`, `cache:`, `otp:` |

### Plugin Integration Tests (`apps/api/test/plugins/redis.test.ts`)

Tests use **mocked ioredis** — no running Redis needed:

| Test | What it validates |
|---|---|
| Plugin decorates `fastify.redis` | RedisClients available on instance |
| `fastify.redis.base` responds to ping | Health check works |
| All namespace clients are present | session, rateLimit, cache, otp available |
| `onClose` hook closes connections | Connections cleaned up on app.close() |

### Config Tests (update existing `apps/api/test/app.test.ts`)

| Test | What it validates |
|---|---|
| Config includes REDIS_URL | Default value is applied |

## Files Summary

### `apps/api` (Backend)

| File | Action |
|---|---|
| `package.json` | [modify] — add `ioredis` dependency |
| `src/lib/config.ts` | [modify] — add REDIS_URL to schema |
| `src/lib/redis.ts` | [new] — Redis client factory + namespaced clients |
| `src/plugins/redis.ts` | [new] — Fastify plugin (decorate + onClose) |
| `src/types/fastify.d.ts` | [modify] — add RedisClients type |
| `src/app.ts` | [modify] — register redis plugin |
| `test/helpers/build-app.ts` | [modify] — add REDIS_URL to test config |
| `test/lib/redis.test.ts` | [new] — Redis client unit tests |
| `test/plugins/redis.test.ts` | [new] — Plugin integration tests |

## Notes

- BullMQ (I-0.1.6) will use `createBullMQConnection()` to get raw ioredis instances for Queue and Worker constructors
- The `bull:` namespace is defined here but not directly used as a keyPrefix — BullMQ manages its own prefix internally via `Queue({ prefix: 'bull' })`
- Sessions (I-0.2.2) will use `fastify.redis.session` for session storage
- Rate limiting (downstream) will use `fastify.redis.rateLimit`
- OTP (I-0.2.1) will use `fastify.redis.otp`
- Health checks (I-0.4.3) will use `fastify.redis.base.ping()`
