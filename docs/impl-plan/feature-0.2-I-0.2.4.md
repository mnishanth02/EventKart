# I-0.2.4: Role-Based Access Control (RBAC) Middleware

**Status:** ✅ Complete
**Started:** 2026-04-22
**Completed:** 2026-04-22
**Dependencies:** I-0.2.3 (session middleware ✅), I-0.1.3 (core database tables ✅)

## Summary

Implement `requireAuth` and `requireRole` Fastify preHandler middleware for route-level access control. Uses a hierarchical role model: `admin > organizer > participant > public`.

## Design Decisions

1. **Hierarchical roles** — `requireRole("participant")` allows participant, organizer, and admin. `requireRole("organizer")` allows organizer and admin. `requireRole("admin")` allows only admin.
2. **`requireRole` implies `requireAuth`** — calling `requireRole("organizer")` automatically checks authentication first (401 before 403).
3. **No array overload** — hierarchy covers all current use cases. Can be extended later if needed.

## Requirements

- **F-0.2.2**: Role-based access control (public, participant, organizer, admin)
- `requireAuth` preHandler: returns 401 if `request.session` is null
- `requireRole(minimumRole)` factory: returns 401 if unauthenticated, 403 if role insufficient
- Structured error responses consistent with existing `AppError` pattern
- Security: Server-side enforcement only — never trust client role claims

## Implementation Steps

### Task 1: Error Classes — `apps/api/src/lib/errors.ts` [modify]

**Complexity:** S
**What:** Add `AuthenticationError` (401) and `AuthorizationError` (403) to existing error hierarchy.
**Details:**

- `AuthenticationError`: statusCode 401, code `UNAUTHENTICATED`, message "Authentication required"
- `AuthorizationError`: statusCode 403, code `INSUFFICIENT_ROLE`, includes `requiredRole` in details

### Task 2: Role Hierarchy Utility — `packages/shared/src/constants/roles.ts` [modify]

**Complexity:** S
**What:** Add `ROLE_HIERARCHY` map and `hasMinimumRole()` utility function to shared package.
**Details:**

- `ROLE_HIERARCHY: Record<UserRole, number>` — maps each role to a numeric level: public=0, participant=1, organizer=2, admin=3
- `hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean` — compares hierarchy levels
- Export from shared package barrel

### Task 3: `requireAuth` Middleware — `apps/api/src/middleware/require-auth.ts` [new]

**Complexity:** S
**What:** Fastify preHandler hook that returns 401 if `request.session` is null.
**Details:**

- Signature: `(request: FastifyRequest, reply: FastifyReply) => Promise<void>`
- Throws `AuthenticationError` if no session
- Usage: `{ onRequest: [requireAuth] }` or `{ preHandler: [requireAuth] }`

### Task 4: `requireRole` Middleware — `apps/api/src/middleware/require-role.ts` [new]

**Complexity:** S
**What:** Factory function returning a Fastify preHandler that checks session + role hierarchy.
**Details:**

- Signature: `(minimumRole: UserRole) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>`
- First checks authentication (throws `AuthenticationError` if no session)
- Then checks `hasMinimumRole(request.session.role, minimumRole)` (throws `AuthorizationError` if insufficient)
- Usage: `{ onRequest: [requireRole("organizer")] }`

### Task 5: Barrel Export — `apps/api/src/middleware/index.ts` [new]

**Complexity:** S
**What:** Re-exports all middleware for clean imports.

### Task 6: Tests — `apps/api/test/middleware/require-auth.test.ts` [new]

**Complexity:** M
**What:** Integration tests for `requireAuth` middleware.
**Test cases:**

- ✅ Allows request with valid session (200)
- ❌ Returns 401 when no session cookie
- ❌ Returns 401 when session is expired/invalid
- ✅ Session data available in handler after auth passes

### Task 7: Tests — `apps/api/test/middleware/require-role.test.ts` [new]

**Complexity:** M
**What:** Integration tests for `requireRole` middleware.
**Test cases:**

- ✅ Admin can access admin-only routes (200)
- ✅ Admin can access organizer routes — hierarchy (200)
- ✅ Admin can access participant routes — hierarchy (200)
- ✅ Organizer can access organizer routes (200)
- ✅ Organizer can access participant routes — hierarchy (200)
- ❌ Participant cannot access organizer routes (403)
- ❌ Participant cannot access admin routes (403)
- ❌ Organizer cannot access admin routes (403)
- ❌ Unauthenticated user gets 401 (not 403)
- ✅ Error response includes required role in details

### Task 8: Shared Package Tests — `packages/shared/src/constants/__tests__/roles.test.ts` [new]

**Complexity:** S
**What:** Unit tests for `hasMinimumRole()` utility.
**Test cases:**

- Hierarchy comparisons for all role combinations
- Same-role returns true
- Higher role returns true
- Lower role returns false

## API Endpoints

No new endpoints. This feature provides middleware used by other routes.

## Database Schema

No changes. Uses existing `role` column in `users` table and `role` field in Redis session data.

## Files Summary

### `packages/shared` (modify)

| File                                    | Action | Purpose                                     |
| --------------------------------------- | ------ | ------------------------------------------- |
| `src/constants/roles.ts`                | modify | Add ROLE_HIERARCHY map and hasMinimumRole() |
| `src/constants/__tests__/roles.test.ts` | new    | Unit tests for role hierarchy utility       |

### `apps/api` (modify + new)

| File                                   | Action | Purpose                                     |
| -------------------------------------- | ------ | ------------------------------------------- |
| `src/lib/errors.ts`                    | modify | Add AuthenticationError, AuthorizationError |
| `src/middleware/require-auth.ts`       | new    | requireAuth preHandler                      |
| `src/middleware/require-role.ts`       | new    | requireRole factory preHandler              |
| `src/middleware/index.ts`              | new    | Barrel export                               |
| `test/middleware/require-auth.test.ts` | new    | requireAuth integration tests               |
| `test/middleware/require-role.test.ts` | new    | requireRole integration tests               |

## Validation

After implementation, run:

```sh
pnpm --filter @repo/shared check-types && pnpm --filter @repo/shared test
pnpm --filter api check-types && pnpm --filter api lint && pnpm --filter api test
```
