# I-0.1.9 — CI/CD Deployment Pipeline

**Status:** ✅ Complete
**Depends on:** I-0.1.1 through I-0.1.8 (all complete)
**Workspaces:** Backend (apps/api), Frontend (apps/web), all packages

---

## Overview

Implements GitHub Actions workflows for continuous integration and continuous deployment:

- **CI** — Lint, type-check, test, and build on every PR and push to `main`.
- **CD (Staging)** — Auto-deploy to Railway staging when CI passes on `main`.
- **CD (Production)** — Manual promote (workflow dispatch) or release tag triggers deploy to Railway production.

All workflows use pnpm caching, Turborepo remote cache, and health-check gates to ensure safe deployments.

---

## Architecture

```
PR/Push → CI (lint + types → test → build)
           ↓ (main branch only)
Staging Deploy (migrate → deploy → health check)
           ↓ (manual promote or release tag)
Production Deploy (migrate → deploy → health check)
```

**Key design decisions:**

- CI runs lint + type-check in parallel, then test, then build (fail-fast ordering).
- Staging auto-deploys after CI passes on `main` — no manual gate.
- Production requires explicit manual dispatch or a GitHub release tag.
- Database migrations run **before** service deployment and block on failure.
- Health checks verify both API (`/health`) and web (HTTP 200) after deploy.

---

## Workflows Created

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | PR to main, push to main | Lint, type-check, test, build |
| `.github/workflows/deploy-staging.yml` | CI passes on main, manual dispatch | Auto-deploy to Railway staging |
| `.github/workflows/deploy-production.yml` | Manual dispatch, release tags | Deploy to Railway production |

---

## Required GitHub Secrets & Variables

| Secret/Variable | Environment | Purpose |
|----------------|-------------|---------|
| `RAILWAY_TOKEN` | staging, production | Railway API authentication |
| `RAILWAY_PROJECT_ID` | staging, production | Railway project identifier |
| `MIGRATION_DATABASE_URL` | staging, production | Direct PostgreSQL URL for migrations (bypasses PgBouncer) |
| `STAGING_API_URL` (variable) | staging | API URL for health checks |
| `STAGING_WEB_URL` (variable) | staging | Web URL for health checks |
| `PRODUCTION_API_URL` (variable) | production | API URL for health checks |
| `PRODUCTION_WEB_URL` (variable) | production | Web URL for health checks |

---

## Railway Services

| Service | Type | Start command | Notes |
|---------|------|---------------|-------|
| api | Web | `node dist/server.js` | Fastify API, auto-scaled |
| web | Web | `node .output/server/index.mjs` | TanStack Start SSR |
| worker | Worker | `node dist/workers/index.js` | BullMQ processors |

---

## Migration Strategy

- Migrations run **before** deployment via `pnpm --filter @repo/db db:migrate:run`.
- Uses `MIGRATION_DATABASE_URL` (direct connection, bypasses PgBouncer) to avoid prepared-statement issues.
- Failed migrations block deployment — the workflow stops and no service update occurs.
- Production deploy has a `skip_migration` input option for code-only deploys where no schema changes are needed.
- Follows the expand/contract migration pattern established in I-0.1.7.

---

## Task Completion

| Task | Description | Status | Completed |
|------|-------------|--------|-----------|
| CI workflow | `.github/workflows/ci.yml` | ✅ | 2026-04-22 |
| Staging deploy | `.github/workflows/deploy-staging.yml` | ✅ | 2026-04-22 |
| Production deploy | `.github/workflows/deploy-production.yml` | ✅ | 2026-04-22 |
| Documentation | Implementation plan + progress tracking | ✅ | 2026-04-22 |
