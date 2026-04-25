# I-0.1.7 — Database Migration CI Pipeline

> Module 0.1: Shared Packages & Database Foundation
> Depends on: I-0.1.2 (packages/db), I-0.1.3 (core tables)

## Overview

Automated CI pipeline that validates database migrations on every PR touching `packages/db/`. Enforces the expand/contract migration pattern by checking for schema drift, running migrations against a fresh PostgreSQL 17 instance, linting for lock-risk SQL patterns, and validating that rollback files exist for every migration.

## Prerequisites

| ID      | Feature                        | Status      |
| ------- | ------------------------------ | ----------- |
| I-0.1.2 | Database package (packages/db) | ✅ Complete |
| I-0.1.3 | Core database tables           | ✅ Complete |

## Scope

**In scope:**

- Programmatic migration runner (applies migrations via `drizzle-orm/migrator`)
- Schema drift detection (compares generated SQL against committed migrations)
- Lock-risk SQL linter (flags dangerous DDL patterns like `ALTER TABLE ... ADD COLUMN ... NOT NULL` without defaults)
- Rollback file validator (ensures every `NNNN_*.sql` has a matching rollback)
- GitHub Actions workflow with PostgreSQL 17 service container
- Package.json script wiring for all new commands

**Out of scope:**

- Production deployment pipelines (handled by deployment infrastructure)
- Automated rollback execution (rollbacks are manual, files are just validated to exist)
- PgBouncer testing in CI (uses direct connection; PgBouncer is production-only)

## Architecture Decisions

1. **Expand/contract enforcement** — The drift checker ensures schema changes always go through migrations, never ad-hoc `db:push`. The lock-risk linter catches patterns that would take exclusive locks on large tables.

2. **Fresh database per run** — CI spins up a clean PostgreSQL 17 container and runs all migrations from scratch. This validates the full migration chain, not just the latest migration.

3. **Rollback convention** — Every migration `drizzle/NNNN_name.sql` must have a corresponding `drizzle/rollbacks/NNNN_name.sql`. The validator enforces this structurally; rollback content correctness is the developer's responsibility.

4. **Lock-risk patterns** — The linter flags CRITICAL patterns (e.g., `NOT NULL` without `DEFAULT`, `ALTER TYPE` on large tables) that require expand/contract. Warnings are logged but don't fail the build.

5. **CI-only validation** — The pipeline validates what's already working locally. Developers run the same scripts locally via `pnpm --filter @repo/db db:check:*`.

## Tasks

| #   | Task                          | File(s)                                            | Complexity | Status |
| --- | ----------------------------- | -------------------------------------------------- | ---------- | ------ |
| 1   | Programmatic migration runner | `packages/db/scripts/migrate.ts`                   | S          |        |
| 2   | Schema drift checker          | `packages/db/scripts/check-schema-drift.ts`        | M          |        |
| 3   | Lock-risk SQL linter          | `packages/db/scripts/check-lock-risk.ts`           | M          |        |
| 4   | Rollback file validator       | `packages/db/scripts/validate-rollbacks.ts`        | S          |        |
| 5   | Rollback convention docs      | `packages/db/drizzle/rollbacks/README.md`          | S          |        |
| 6   | Lock-risk checker tests       | `packages/db/test/scripts/check-lock-risk.test.ts` | M          |        |
| 7   | GitHub Actions CI workflow    | `.github/workflows/migration-ci.yml`               | M          |        |
| 8   | Package.json script updates   | `packages/db/package.json`                         | S          |        |

## CI Workflow Summary

**Trigger:** `pull_request` on `main` (paths: `packages/db/**`) + `workflow_dispatch`

**Steps:**

1. Checkout → Setup pnpm 10 → Setup Node.js 22 → Install deps
2. `db:check:drift` — Verify no uncommitted schema changes
3. `db:migrate:run` — Apply all migrations to fresh PostgreSQL 17
4. `db:check:lock-risk` — Flag dangerous DDL patterns
5. `db:check:rollbacks` — Validate rollback files exist
6. `pnpm --filter @repo/db test` — Run DB package tests

**Services:** PostgreSQL 17-alpine (user: `eventkart`, db: `eventkart_dev`)

## Package.json Scripts

```jsonc
// packages/db/package.json — new scripts
{
  "db:migrate:run": "tsx scripts/migrate.ts",
  "db:check:drift": "tsx scripts/check-schema-drift.ts",
  "db:check:lock-risk": "tsx scripts/check-lock-risk.ts",
  "db:check:rollbacks": "tsx scripts/validate-rollbacks.ts",
}
```

## Notes

- The same scripts run locally and in CI — no CI-specific logic in the scripts themselves
- `MIGRATION_DATABASE_URL` is set equal to `DATABASE_URL` in CI; in production it bypasses PgBouncer for DDL operations
- PostgreSQL 17 is pinned to match the production target and local Docker Compose
- Concurrency group `migration-ci-${{ github.ref }}` cancels stale runs on force-push
