# I-0.1.6 — BullMQ Queue Infrastructure

> Module 0.1: Shared Packages & Database Foundation
> Maps to: — (architecture requirement)

## Overview

Set up BullMQ queue infrastructure for the Fastify API with queue definitions, a worker service skeleton, and a custom DLQ (dead letter queue) pattern. Four domain queues (`payment-webhook`, `email`, `cleanup`, `exports`) plus a `failed-jobs` queue for DLQ tracking.

## Prerequisites

| ID | Feature | Status |
|---|---|---|
| I-0.1.5 | Redis client setup (namespaced connections) | ✅ Complete |

## Requirements

### Functional

- Define 4 domain queues: `payment-webhook`, `email`, `cleanup`, `exports`
- Define 1 DLQ queue: `failed-jobs`
- Each queue has per-queue default job options (attempts, backoff, cleanup)
- Worker service skeleton with graceful shutdown (SIGTERM/SIGINT)
- DLQ pattern: `failed` event handler moves exhausted jobs to `failed-jobs` queue
- Fastify plugin decorates instance with queue producers

### Non-Functional

- Workers run as a separate Railway service (never in the API process)
- Shared Redis connection for all Queue instances in the API
- Graceful shutdown: all queues closed on Fastify `onClose`, then connection quit

### Security

- No credentials in logs
- `REDIS_URL` is server-only (already in config from I-0.1.5)

## New Dependency

| Package | Version | Why |
|---|---|---|
| `bullmq` | `^5` | Production-ready queue system. Uses ioredis internally. Supports delayed jobs, repeatable jobs, priorities, rate limiting. |

## Implementation Tasks

| # | Task | File(s) | Complexity | Status |
|---|------|---------|------------|--------|
| 1 | Install `bullmq` | `apps/api/package.json` | S | ✅ |
| 2 | Create queue library | `apps/api/src/lib/queue.ts` [new] | M | ✅ |
| 3 | Create worker skeleton — index.ts | `apps/api/src/workers/index.ts` [new] | M | ✅ |
| 4 | Create worker skeleton — payment-webhook | `apps/api/src/workers/payment-webhook.ts` [new] | S | ✅ |
| 5 | Create worker skeleton — email | `apps/api/src/workers/email.ts` [new] | S | ✅ |
| 6 | Create worker skeleton — cleanup | `apps/api/src/workers/cleanup.ts` [new] | S | ✅ |
| 7 | Create worker skeleton — exports | `apps/api/src/workers/exports.ts` [new] | S | ✅ |
| 8 | Create Fastify queue plugin | `apps/api/src/plugins/queue.ts` [new] | S | ✅ |
| 9 | Update Fastify type declarations | `apps/api/src/types/fastify.d.ts` [modify] | S | ✅ |
| 10 | Register plugin in app factory | `apps/api/src/app.ts` [modify] | S | ✅ |
| 11 | Update test setup with bullmq mock | `apps/api/test/setup.ts` [modify] | S | ✅ |
| 12 | Create queue lib unit tests | `apps/api/test/lib/queue.test.ts` [new] | M | ✅ |
| 13 | Create queue plugin integration tests | `apps/api/test/plugins/queue.test.ts` [new] | M | ✅ |
| 14 | Validate check-types + lint + test | — | S | ✅ |

## Detailed Design

### Task 2: Queue Library (`apps/api/src/lib/queue.ts`)

Exports the following:

```typescript
// Queue name constants
export const QUEUE_NAMES = {
  paymentWebhook: "payment-webhook",
  email: "email",
  cleanup: "cleanup",
  exports: "exports",
  failedJobs: "failed-jobs",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Per-queue config — concurrency + default job options
export const QUEUE_CONFIGS: Record<QueueName, {
  concurrency: number;
  defaultJobOptions: Record<string, unknown>;
}>;

// Typed queue container
export interface AppQueues {
  paymentWebhook: Queue;
  email: Queue;
  cleanup: Queue;
  exports: Queue;
  failedJobs: Queue;
}

// Factory: creates all queue instances sharing one ioredis connection
export function createQueues(connection: Redis): AppQueues;

// Graceful shutdown — closes all queues
export async function closeQueues(queues: AppQueues): Promise<void>;

// DLQ handler — moves exhausted jobs to the failed-jobs queue
export interface FailedJobData { queue, jobId, jobName, data, error, stackTrace, attemptsMade, failedAt }
export function createDLQHandler(failedJobsQueue: Queue): (job, error) => Promise<void>;
```

**Queue configuration table:**

| Queue | Concurrency | Attempts | Backoff | removeOnComplete | removeOnFail |
|---|---|---|---|---|---|
| `payment-webhook` | 10 | 3 | exponential, 1s base | 1000 | 5000 |
| `email` | 5 | 2 | exponential, 1s base | 1000 | 5000 |
| `cleanup` | 2 | 1 | none | 100 | 5000 |
| `exports` | 1 | 2 | exponential, 1s base | 100 | 5000 |
| `failed-jobs` | 1 | 1 | none | 10000 | false |

### Task 8: Fastify Queue Plugin (`apps/api/src/plugins/queue.ts`)

```typescript
const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const connection = createBullMQConnection(fastify.config.REDIS_URL);
  const queues = createQueues(connection);

  fastify.decorate("queues", queues);

  fastify.addHook("onClose", async () => {
    await closeQueues(queues);
    await connection.quit();
  });
};

export default fp(queuePlugin, {
  name: "queue",
  dependencies: ["config", "redis"],
  fastify: "5.x",
});
```

- Depends on `config` (for `REDIS_URL`) and `redis` (registration order)
- Uses a dedicated BullMQ connection (no keyPrefix — BullMQ manages its own prefix)
- Decorates `fastify.queues` with all queue producers

### Task 3–7: Worker Service Skeleton (`apps/api/src/workers/`)

Workers are designed as a **separate Railway service** and are never imported by the Fastify API process.

**Entry point (`index.ts`):**
- Creates a single ioredis connection (`maxRetriesPerRequest: null` for BullMQ)
- Creates a DLQ queue (`failed-jobs`) and `createDLQHandler` callback
- Instantiates all 4 domain workers via factory functions
- Registers SIGTERM/SIGINT handlers for graceful shutdown
- Exports `startWorkers()` — does NOT auto-start at module level (testable)

**Worker factory pattern (each file):**
```typescript
export function create<Name>Worker(connection: Redis, onFailed: DLQHandler): Worker {
  const config = QUEUE_CONFIGS[QUEUE_NAMES.<name>];
  const worker = new Worker(QUEUE_NAMES.<name>, processor, {
    connection,
    concurrency: config.concurrency,
  });
  worker.on("failed", (job, err) => void onFailed(job, err));
  return worker;
}
```

Key pattern notes:
- `void onFailed(job, err)` — the `void` operator prevents unhandled promise rejection warnings (Biome requires this for fire-and-forget promises)
- `DLQHandler` type is repeated in each file to avoid circular imports back to `queue.ts`
- Processor functions currently throw `Error("not implemented")` — real logic is deferred to domain feature implementation

### DLQ Mechanism

BullMQ has no native dead letter queue. The custom DLQ works as follows:

1. Each worker registers a `failed` event handler via `onFailed` callback
2. The handler checks `job.attemptsMade >= job.opts.attempts` — only acts when all retries are exhausted
3. Failed job metadata (queue name, job ID, data, error, stack trace, timestamp) is added to the `failed-jobs` queue
4. The `failed-jobs` queue uses `removeOnFail: false` to preserve all entries for admin review
5. Job ID in the DLQ uses format `${queueName}:${jobId}:${timestamp}` for uniqueness

## Testing Plan

### Unit Tests (`apps/api/test/lib/queue.test.ts`)

Tests use **mocked BullMQ** (vi.mock) — no running Redis needed:

| Test | What it validates |
|---|---|
| `QUEUE_NAMES` has correct values | All 5 queue name constants match expected strings |
| `QUEUE_CONFIGS` has entries for all queues | Every QueueName key has concurrency + defaultJobOptions |
| `createQueues` returns all queue instances | All 5 fields on AppQueues are Queue instances |
| `createQueues` passes connection to all queues | Shared connection used for all Queue constructors |
| `createQueues` applies defaultJobOptions | Per-queue job options passed to Queue constructor |
| `closeQueues` closes all queues | All 5 queues have `.close()` called |
| `closeQueues` tolerates close() rejection | Uses `allSettled`, doesn't throw on failure |
| `createDLQHandler` ignores undefined job | Returns without adding to DLQ |
| `createDLQHandler` ignores non-exhausted retries | `attemptsMade < attempts` → no DLQ entry |
| `createDLQHandler` moves exhausted job to DLQ | Adds job to `failed-jobs` queue with correct data |
| `FailedJobData` shape is correct | DLQ entry contains queue, jobId, error, stackTrace, failedAt |

### Plugin Integration Tests (`apps/api/test/plugins/queue.test.ts`)

Tests use **mocked BullMQ + ioredis** — no running Redis needed:

| Test | What it validates |
|---|---|
| Plugin decorates `fastify.queues` | AppQueues available on instance |
| All queue producers are present | paymentWebhook, email, cleanup, exports, failedJobs |
| `onClose` hook closes queues | All queues closed when app closes |
| `onClose` quits BullMQ connection | Connection quit after queues closed |

## Files Summary

### `apps/api` (Backend)

| File | Action |
|---|---|
| `package.json` | [modify] — add `bullmq` dependency |
| `src/lib/queue.ts` | [new] — Queue constants, config, factories, DLQ handler |
| `src/plugins/queue.ts` | [new] — Fastify plugin (decorate + onClose) |
| `src/types/fastify.d.ts` | [modify] — add AppQueues type |
| `src/app.ts` | [modify] — register queue plugin |
| `src/workers/index.ts` | [new] — Worker service entry point |
| `src/workers/payment-webhook.ts` | [new] — Payment webhook worker skeleton |
| `src/workers/email.ts` | [new] — Email worker skeleton |
| `src/workers/cleanup.ts` | [new] — Cleanup worker skeleton |
| `src/workers/exports.ts` | [new] — Exports worker skeleton |
| `test/lib/queue.test.ts` | [new] — Queue library unit tests |
| `test/plugins/queue.test.ts` | [new] — Queue plugin integration tests |

## Notes

- **Payment processing** (I-3.x): `payment-webhook` queue processes Razorpay webhook events → booking state transitions → downstream email confirmations
- **Communications** (I-1.x): `email` queue handles booking confirmations, reminders, OTP delivery via Resend + SES fallback
- **Data lifecycle** (I-5.x): `cleanup` queue runs 30-day post-event sensitive data expiry (PII fields, KYC documents)
- **Organizer tools** (I-5.x): `exports` queue generates roster PDF/CSV downloads for event organizers
- Workers share the same `queue.ts` library as the API — producers run in the API process, consumers run in the worker service
- A production entry point script (e.g., `apps/api/src/workers/start.ts`) will call `startWorkers()` — deferred to deployment configuration phase
