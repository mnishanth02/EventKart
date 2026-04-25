# I-0.1.4 — Local Development Infrastructure (Docker Compose)

> Module 0.1: Shared Packages & Database Foundation
> Maps to requirement F-0.1.4

## Overview

Docker Compose configuration for local development providing PostgreSQL 17 and Redis 7 services with production-aligned configuration.

## Prerequisites

- None (can run in parallel with I-0.1.1)
- Docker and Docker Compose must be installed on developer machines

## Requirements

- PostgreSQL 17 running locally on port 5432
- Redis 7 running locally on port 6379 with volatile-lru eviction policy (256MB max memory)
- Persistent volumes for data survival across restarts
- Health checks for both services
- Connection strings documented in .env.example
- Convenience scripts for starting/stopping services

## Implementation Tasks

| #   | Task                           | File(s)                          | Complexity | Status        |
| --- | ------------------------------ | -------------------------------- | ---------- | ------------- |
| 1   | Create Docker Compose file     | `docker-compose.yml` [new]       | S          | ✅ 2026-04-22 |
| 2   | Update API env example         | `apps/api/.env.example` [modify] | S          | ✅ 2026-04-22 |
| 3   | Add Docker convenience scripts | `package.json` [modify]          | S          | ✅ 2026-04-22 |
| 4   | Update .gitignore              | `.gitignore` [modify]            | S          | ✅ 2026-04-22 |

## Docker Compose Services

### PostgreSQL 17

- Image: `postgres:17-alpine`
- Container: `eventkart-postgres`
- Port: `5432:5432`
- Credentials: `eventkart` / `eventkart_dev` / `eventkart_dev` (user/password/database)
- Volume: `eventkart-pgdata` → `/var/lib/postgresql/data`
- Health check: `pg_isready -U eventkart -d eventkart_dev`

### Redis 7

- Image: `redis:7-alpine`
- Container: `eventkart-redis`
- Port: `6379:6379`
- Config: `--maxmemory 256mb --maxmemory-policy volatile-lru --appendonly yes`
- Volume: `eventkart-redisdata` → `/data`
- Health check: `redis-cli ping`

## Environment Variables

| Variable     | Value                                                               | Used by                |
| ------------ | ------------------------------------------------------------------- | ---------------------- |
| DATABASE_URL | `postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev` | I-0.1.2 (Drizzle ORM)  |
| REDIS_URL    | `redis://localhost:6379`                                            | I-0.1.5 (Redis client) |

Note: These are added to `.env.example` as documentation. Config validation (in `config.ts`) is deferred to the features that consume them.

## Convenience Scripts (root package.json)

| Script         | Command                  | Purpose                             |
| -------------- | ------------------------ | ----------------------------------- |
| `docker:up`    | `docker compose up -d`   | Start services in background        |
| `docker:down`  | `docker compose down`    | Stop services                       |
| `docker:reset` | `docker compose down -v` | Stop + remove volumes (clean slate) |

## Testing Plan

- Validate `docker-compose.yml` syntax with `docker compose config`
- Verify services start with `pnpm docker:up`
- Verify health checks pass
- Verify services stop with `pnpm docker:down`

## Security Notes

- Docker Compose credentials are for LOCAL DEVELOPMENT ONLY
- Production uses Railway managed PostgreSQL + Redis with proper secrets
- `docker-compose.override.yml` is gitignored for local customizations

## Files Summary

| File                    | Action   |
| ----------------------- | -------- |
| `docker-compose.yml`    | [new]    |
| `apps/api/.env.example` | [modify] |
| `package.json`          | [modify] |
| `.gitignore`            | [modify] |
