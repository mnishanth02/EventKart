# I-0.4.4: Audit Log Table and Logging Utility

**Feature ID:** I-0.4.4
**Module:** 0.4 — Observability, Metrics & Error Infrastructure
**Scope:** Backend only (`apps/api`) + shared constants (`packages/shared`)
**Dependencies:** I-0.1.3 (core database tables) — ✅ complete
**Downstream:** I-1.1.5 (admin verification review), I-1.2.7 (admin event review), I-7.1.4 (settled funds handling), I-7.2.2 (admin dispute queue), I-7.2.4 (organizer suspension), I-7.3.4 (audit log viewer)

---

## Requirements

### Functional
- **R1:** Type-safe audit logging utility that writes to the existing `audit_log` table
- **R2:** Single-entry and batch insert support
- **R3:** Fire-and-forget error handling — audit writes never fail the caller; errors are logged via Pino
- **R4:** Well-defined audit action and resource type constants in `packages/shared` for type safety and downstream use (audit log viewer I-7.3.4)
- **R5:** Portable — works in both Fastify route handlers and BullMQ workers (no Fastify coupling)
- **R6:** Accepts actor info (userId, role), action, resource type/id, arbitrary metadata (JSONB), and IP address

### Security (OWASP)
- **S1:** Metadata field must not contain sensitive data (PII, secrets) — caller responsibility, documented in JSDoc
- **S2:** IP address stored for forensic analysis of admin actions
- **S3:** Append-only table — no FK on actor_id (logs outlive user deletion, 3-year retention)

### Performance
- **P1:** Batch inserts for bulk operations (single INSERT with multiple VALUES)
- **P2:** No blocking — errors caught internally, logged, not propagated

---

## Existing Infrastructure

The `audit_log` table already exists in `packages/db/src/schema/audit-log.ts`:
- `id` (UUID, PK, defaultRandom)
- `actorId` (UUID, nullable — no FK)
- `actorRole` (user_role enum, nullable)
- `action` (varchar 100, NOT NULL)
- `resourceType` (varchar 100, NOT NULL)
- `resourceId` (varchar 255, nullable)
- `metadata` (JSONB, nullable)
- `ipAddress` (varchar 45, nullable)
- `createdAt` (timestamptz, NOT NULL, defaultNow)

Indexes: `(actorId, createdAt)`, `(resourceType, resourceId, createdAt)`, `(createdAt)`

---

## Implementation Steps

### Task 1: Shared audit constants — `packages/shared` [S]

| # | File | Action | Description |
|---|------|--------|-------------|
| 1a | `packages/shared/src/constants/audit.ts` | [new] | Define `AUDIT_ACTIONS` (domain.verb format), `AUDIT_RESOURCE_TYPES`, and TypeScript types |
| 1b | `packages/shared/src/constants/index.ts` | [modify] | Re-export audit constants |

### Task 2: Audit logging utility — `apps/api` [M]

| # | File | Action | Description |
|---|------|--------|-------------|
| 2a | `apps/api/src/lib/audit.ts` | [new] | `createAuditLogger(db, log)` factory returning `AuditLogger` with `log()` and `logBatch()`. Error-swallowing with Pino logging. |

### Task 3: Tests — `apps/api` [M]

| # | File | Action | Description |
|---|------|--------|-------------|
| 3a | `apps/api/test/lib/audit.test.ts` | [new] | Unit tests: happy path (single + batch), error handling, null fields, empty batch no-op, metadata JSONB |

### Task 4: Validation [S]

Run `pnpm --filter @repo/shared check-types`, `pnpm --filter api check-types`, `pnpm --filter api lint`, `pnpm --filter api test` to ensure no regressions.

---

## API Surface

```typescript
// apps/api/src/lib/audit.ts

interface AuditEntry {
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;           // Use AUDIT_ACTIONS constants for type hints
  resourceType: string;     // Use AUDIT_RESOURCE_TYPES constants
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
  logBatch(entries: readonly AuditEntry[]): Promise<void>;
}

function createAuditLogger(db: Database, log: FastifyBaseLogger): AuditLogger;
```

### Usage in route handlers:
```typescript
const audit = createAuditLogger(fastify.db, request.log);
await audit.log({
  actorId: request.session!.userId,
  actorRole: request.session!.role,
  action: AUDIT_ACTIONS.ORGANIZER_APPROVE,
  resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
  resourceId: organizerId,
  metadata: { notes: "Approved after document review" },
  ipAddress: request.ip,
});
```

---

## Testing Plan

| Test | What it validates |
|------|-------------------|
| Single entry write — happy path | Calls db.insert with correct values |
| Batch write — happy path | Inserts multiple entries in one call |
| Error handling — DB failure | Catches error, logs it, does not throw |
| Batch error handling — DB failure | Catches batch error, logs it, does not throw |
| Null/optional fields | Handles missing actorId, metadata, ipAddress |
| Empty batch is no-op | Does not call db.insert for empty array |
| Metadata JSONB | Arbitrary objects are passed through correctly |

---

## Files Summary

| Workspace | File | Action |
|-----------|------|--------|
| `packages/shared` | `src/constants/audit.ts` | [new] |
| `packages/shared` | `src/constants/index.ts` | [modify] |
| `apps/api` | `src/lib/audit.ts` | [new] |
| `apps/api` | `test/lib/audit.test.ts` | [new] |
