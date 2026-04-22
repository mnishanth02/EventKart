# I-0.1.3 — Core Database Tables

> Module 0.1: Shared Packages & Database Foundation
> Foundation tables referenced by every module

## Overview

Create the core database tables in `packages/db`: users, sessions, consent_records, and audit_log. These are foundation tables that every other module depends on. All timestamps are stored as UTC.

## Prerequisites

- ✅ I-0.1.1: `packages/shared` (roles, types, constants)
- ✅ I-0.1.4: Docker Compose (PostgreSQL 17)
- ✅ I-0.1.2: `packages/db` (Drizzle ORM client, migration tooling)

## Tables

### users
Primary identity table for all user types.
- `id` UUID PK (gen_random_uuid)
- `phone` varchar(20) UNIQUE (E.164 format, nullable for admin)
- `email` varchar(255) (nullable, not unique — organizer email on separate table)
- `name` varchar(255)
- `role` user_role ENUM NOT NULL DEFAULT 'public'
- `created_at` timestamptz NOT NULL DEFAULT now()
- `deleted_at` timestamptz (soft delete)
- Indexes: email, role

### sessions
Persistent session records (runtime sessions cached in Redis).
- `id` UUID PK (gen_random_uuid)
- `user_id` UUID NOT NULL FK → users(id) ON DELETE CASCADE
- `data` JSONB
- `expires_at` timestamptz NOT NULL
- Indexes: user_id, expires_at

### consent_records
DPDPA-compliant consent tracking.
- `id` UUID PK (gen_random_uuid)
- `participant_id` UUID NOT NULL FK → users(id) (no cascade — retained for compliance)
- `consent_type` consent_type ENUM NOT NULL (booking_terms, data_usage, marketing)
- `consent_version` varchar(50) NOT NULL
- `accepted_at` timestamptz NOT NULL DEFAULT now()
- `withdrawn_at` timestamptz
- `ip_address` varchar(45)
- Indexes: participant_id, (participant_id + consent_type)
- Unique: (participant_id, consent_type, consent_version)

### audit_log
Append-only audit trail retained 3+ years.
- `id` UUID PK (gen_random_uuid)
- `actor_id` UUID (nullable for system actions, NO FK — outlives users)
- `actor_role` user_role ENUM
- `action` varchar(100) NOT NULL
- `resource_type` varchar(100) NOT NULL
- `resource_id` varchar(255)
- `metadata` JSONB
- `ip_address` varchar(45)
- `created_at` timestamptz NOT NULL DEFAULT now()
- Indexes: actor_id, (resource_type + resource_id), created_at

## PostgreSQL Enums
- `user_role`: public, participant, organizer, admin
- `consent_type`: booking_terms, data_usage, marketing

## Implementation Tasks

| # | Task | File(s) | Complexity | Status |
|---|------|---------|------------|--------|
| 1 | Users table + userRoleEnum | `packages/db/src/schema/users.ts` [new] | M | ✅ 2026-04-22 |
| 2 | Sessions table (metadata-only) | `packages/db/src/schema/sessions.ts` [new] | S | ✅ 2026-04-22 |
| 3 | Consent records table + consentTypeEnum | `packages/db/src/schema/consent-records.ts` [new] | M | ✅ 2026-04-22 |
| 4 | Audit log table | `packages/db/src/schema/audit-log.ts` [new] | M | ✅ 2026-04-22 |
| 5 | Update schema barrel | `packages/db/src/schema/index.ts` [modify] | S | ✅ 2026-04-22 |
| 6 | Add @repo/shared dependency | `packages/db/package.json` [modify] | S | ✅ 2026-04-22 |
| 7 | Generate migration | `packages/db/drizzle/` [new] | S | ✅ 2026-04-22 |
| 8 | Schema export tests | `packages/db/test/schema.test.ts` [new] | S | ✅ 2026-04-22 |
| 9 | Validate (lint + check-types + test) | — | S | ✅ 2026-04-22 |

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No FK on audit_log.actor_id | Plain UUID | Audit logs outlive users (3yr retention). FK prevents hard deletion. |
| sessions.user_id CASCADE | ON DELETE CASCADE | Sessions removed when user deleted |
| consent_records no cascade | No cascade | DPDPA requires consent records retained after user deletion |
| phone unique + nullable | UNIQUE constraint | Primary auth identifier; nullable for admin-created users |
| email not unique | No unique constraint | Organizer email lives on organizers table (Phase 1) |
| Timestamps with timezone | withTimezone: true | Explicit UTC storage in PostgreSQL |

## Testing Plan

- Schema exports test: verify all tables and enums are exported correctly
- Column existence tests: verify key columns exist on each table
- Migration generation validation: drizzle-kit generate produces valid SQL

## Security Notes

- Soft delete via `deleted_at` — no hard deletes in normal operation
- Audit log is append-only — no UPDATE/DELETE in application code
- Consent records immutable after creation (withdrawn_at is the only mutable field)
- IP addresses stored for audit/compliance purposes

## Files Summary

| File | Action |
|------|--------|
| `packages/db/src/schema/users.ts` | [new] |
| `packages/db/src/schema/sessions.ts` | [new] |
| `packages/db/src/schema/consent-records.ts` | [new] |
| `packages/db/src/schema/audit-log.ts` | [new] |
| `packages/db/src/schema/index.ts` | [modify] |
| `packages/db/package.json` | [modify] |
| `packages/db/drizzle/*` | [new — generated migration] |
| `packages/db/test/schema.test.ts` | [new] |
