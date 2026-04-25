# I-0.1.2 — `packages/db` (Drizzle ORM Schema, Migrations, Seed, Client)

> Module 0.1: Shared Packages & Database Foundation
> Maps to requirement F-0.1.2

## Overview

Create the `packages/db` workspace package providing the Drizzle ORM database client, migration tooling via Drizzle Kit, and seed script skeleton. This package is the foundation for all database access in EventKart.

## Prerequisites

- ✅ I-0.1.1: `packages/shared` (Zod schemas, types, constants)
- ✅ I-0.1.4: Docker Compose (PostgreSQL 17 + Redis 7)

## Requirements

- Drizzle ORM client with `prepare: false` for PgBouncer transaction pooling compatibility
- postgres.js driver for lightweight PostgreSQL connections
- Drizzle Kit configuration for migration generation and management
- Schema barrel file ready for table definitions (I-0.1.3)
- Seed script skeleton for local development data
- Separate migration client for direct connections (bypasses PgBouncer)
- Package exports consumable by `apps/api` and other workspace packages

## Key Architecture Decisions

| Decision          | Choice                           | Rationale                                                                   |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------- |
| PostgreSQL driver | postgres.js (`postgres`)         | Lightweight, explicit `prepare: false` at driver level, serverless-friendly |
| ORM               | Drizzle ORM                      | Type-safe, SQL-like API, lightweight, great TS types                        |
| Migrations        | Drizzle Kit                      | Integrated with Drizzle ORM, generates SQL migrations                       |
| PgBouncer compat  | `prepare: false`                 | Mandatory for transaction pooling mode                                      |
| Migration client  | Separate `createMigrationClient` | Direct DB connection for migrations (bypasses PgBouncer in production)      |

## Implementation Tasks

| #   | Task                    | File(s)                                 | Complexity | Status        |
| --- | ----------------------- | --------------------------------------- | ---------- | ------------- |
| 1   | Package setup           | `packages/db/package.json` [new]        | S          | ✅ 2026-04-22 |
| 2   | TypeScript config       | `packages/db/tsconfig.json` [new]       | S          | ✅ 2026-04-22 |
| 3   | Vitest config           | `packages/db/vitest.config.ts` [new]    | S          | ✅ 2026-04-22 |
| 4   | Drizzle Kit config      | `packages/db/drizzle.config.ts` [new]   | S          | ✅ 2026-04-22 |
| 5   | Database client factory | `packages/db/src/client.ts` [new]       | M          | ✅ 2026-04-22 |
| 6   | Package barrel export   | `packages/db/src/index.ts` [new]        | S          | ✅ 2026-04-22 |
| 7   | Schema barrel export    | `packages/db/src/schema/index.ts` [new] | S          | ✅ 2026-04-22 |
| 8   | Seed script skeleton    | `packages/db/src/seed.ts` [new]         | S          | ✅ 2026-04-22 |
| 9   | Smoke tests             | `packages/db/test/client.test.ts` [new] | S          | ✅ 2026-04-22 |

## Package Exports

```
@repo/db            → src/index.ts (createDatabase, Database type)
@repo/db/client     → src/client.ts (createDatabase, createMigrationClient, Database)
@repo/db/schema     → src/schema/index.ts (table definitions, initially empty)
```

## Database Client API

```typescript
// App usage (through PgBouncer)
import { createDatabase } from "@repo/db";
const db = createDatabase(process.env.DATABASE_URL);

// Migration usage (direct connection)
import { createMigrationClient } from "@repo/db/client";
const migrationDb = createMigrationClient(process.env.MIGRATION_DATABASE_URL);
```

## DB Scripts (packages/db)

| Script        | Command                | Purpose                                              |
| ------------- | ---------------------- | ---------------------------------------------------- |
| `db:generate` | `drizzle-kit generate` | Generate SQL migrations from schema changes          |
| `db:migrate`  | `drizzle-kit migrate`  | Apply pending migrations                             |
| `db:push`     | `drizzle-kit push`     | Push schema directly (rapid dev, no migration files) |
| `db:studio`   | `drizzle-kit studio`   | Open Drizzle Studio GUI                              |
| `db:seed`     | `tsx src/seed.ts`      | Run seed script                                      |

## Testing Plan

- Smoke test: validates `createDatabase` export exists and is a function
- Integration tests will be added in I-0.1.3 when actual tables exist

## Security Notes

- `DATABASE_URL` is read from environment — never hardcoded
- `prepare: false` prevents prepared statement caching (PgBouncer requirement)
- Migration client uses `max: 1` to prevent connection pool issues

## Files Summary

| File                              | Action |
| --------------------------------- | ------ |
| `packages/db/package.json`        | [new]  |
| `packages/db/tsconfig.json`       | [new]  |
| `packages/db/vitest.config.ts`    | [new]  |
| `packages/db/drizzle.config.ts`   | [new]  |
| `packages/db/src/index.ts`        | [new]  |
| `packages/db/src/client.ts`       | [new]  |
| `packages/db/src/schema/index.ts` | [new]  |
| `packages/db/src/seed.ts`         | [new]  |
| `packages/db/test/client.test.ts` | [new]  |
