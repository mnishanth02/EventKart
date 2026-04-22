# Implementation Plan: I-0.1.1 — `packages/shared`

**Feature:** Shared Zod schemas, types, and constants
**Module:** 0.1 — Shared Packages & Database Foundation
**Requirements:** F-0.1.1 (Initialize project structure — shared packages portion)
**Prerequisites:** None (this is the foundation)
**Affected workspaces:** `packages/shared` (new), `apps/api` (add dep), `apps/web` (add dep)

---

## Requirements

### Acceptance Criteria

1. `packages/shared` exists as a pnpm workspace package named `@repo/shared`
2. Phone number schema validates and normalizes Indian numbers to E.164 format (`+91XXXXXXXXXX`)
3. All base schemas are importable from both `apps/web` and `apps/api` via `@repo/shared/*`
4. `pnpm check-types`, `pnpm lint`, and `pnpm test` pass across the entire workspace
5. Both apps declare `@repo/shared` as a dependency

### Security

- Phone normalization strips non-digit characters to prevent injection
- Email validation uses strict Zod email validation
- No secrets or env vars in the shared package

### Performance

- N/A (compile-time only; zero runtime cost beyond Zod schema parsing)

---

## Implementation Steps

### Phase 1: Package Structure (S)

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `packages/shared/package.json` | [new] | Package manifest with path-based exports |
| 2 | `packages/shared/tsconfig.json` | [new] | TypeScript config extending `@repo/typescript-config/base.json` |
| 3 | `packages/shared/vitest.config.ts` | [new] | Vitest configuration |

### Phase 2: Schemas (M)

| # | File | Action | Description |
|---|------|--------|-------------|
| 4 | `packages/shared/src/schemas/phone.ts` | [new] | Indian phone schema with E.164 normalization (`+91XXXXXXXXXX`) |
| 5 | `packages/shared/src/schemas/email.ts` | [new] | Email Zod schema |
| 6 | `packages/shared/src/schemas/id.ts` | [new] | UUID schema |
| 7 | `packages/shared/src/schemas/pagination.ts` | [new] | Offset + cursor pagination request/response schemas |
| 8 | `packages/shared/src/schemas/api-response.ts` | [new] | Success/error API envelope schemas |
| 9 | `packages/shared/src/schemas/date.ts` | [new] | ISO date and timestamp schemas |
| 10 | `packages/shared/src/schemas/index.ts` | [new] | Re-export barrel |

### Phase 3: Types & Constants (S)

| # | File | Action | Description |
|---|------|--------|-------------|
| 11 | `packages/shared/src/constants/roles.ts` | [new] | User role enum: `public`, `participant`, `organizer`, `admin` |
| 12 | `packages/shared/src/constants/pagination.ts` | [new] | Default page size, max page size |
| 13 | `packages/shared/src/constants/index.ts` | [new] | Re-export barrel |
| 14 | `packages/shared/src/types/api.ts` | [new] | Inferred types from API response schemas |
| 15 | `packages/shared/src/types/index.ts` | [new] | Re-export barrel |

### Phase 4: Utilities (S)

| # | File | Action | Description |
|---|------|--------|-------------|
| 16 | `packages/shared/src/utils/phone.ts` | [new] | `normalizePhone()` — strips non-digits, validates length, prepends `+91` |
| 17 | `packages/shared/src/utils/index.ts` | [new] | Re-export barrel |

### Phase 5: Tests (M)

| # | File | Action | Description |
|---|------|--------|-------------|
| 18 | `packages/shared/test/schemas/phone.test.ts` | [new] | Phone schema: valid Indian numbers, E.164 output, rejects invalid |
| 19 | `packages/shared/test/schemas/email.test.ts` | [new] | Email schema: valid emails, rejects invalid |
| 20 | `packages/shared/test/schemas/pagination.test.ts` | [new] | Pagination: defaults, bounds, cursor |
| 21 | `packages/shared/test/schemas/api-response.test.ts` | [new] | API envelope: success/error shapes |
| 22 | `packages/shared/test/utils/phone.test.ts` | [new] | normalizePhone: various input formats, error cases |

### Phase 6: Integration (S)

| # | File | Action | Description |
|---|------|--------|-------------|
| 23 | `apps/api/package.json` | [modify] | Add `"@repo/shared": "workspace:*"` dependency |
| 24 | `apps/web/package.json` | [modify] | Add `"@repo/shared": "workspace:*"` dependency |

---

## Export Structure

```
@repo/shared/schemas     → all Zod schemas
@repo/shared/constants   → role enum, pagination defaults
@repo/shared/types       → inferred TypeScript types
@repo/shared/utils       → phone normalization utility
```

---

## Testing Plan

| Test File | Validates |
|-----------|-----------|
| `test/schemas/phone.test.ts` | Valid 10-digit Indian numbers, +91 prefix, 0-prefix stripping, country code stripping, rejects non-Indian, rejects short/long numbers |
| `test/schemas/email.test.ts` | Valid emails, rejects empty, rejects invalid format |
| `test/schemas/pagination.test.ts` | Default values applied, max limit capped, cursor string validation, offset calculation |
| `test/schemas/api-response.test.ts` | Success envelope shape, error envelope with code/message, type inference |
| `test/utils/phone.test.ts` | normalizePhone with various input formats (raw digits, +91 prefix, 0 prefix, spaces/dashes), error on invalid |

---

## Files Summary

### `packages/shared` [new package]
- `package.json` [new]
- `tsconfig.json` [new]
- `vitest.config.ts` [new]
- `src/schemas/phone.ts` [new]
- `src/schemas/email.ts` [new]
- `src/schemas/id.ts` [new]
- `src/schemas/pagination.ts` [new]
- `src/schemas/api-response.ts` [new]
- `src/schemas/date.ts` [new]
- `src/schemas/index.ts` [new]
- `src/constants/roles.ts` [new]
- `src/constants/pagination.ts` [new]
- `src/constants/index.ts` [new]
- `src/types/api.ts` [new]
- `src/types/index.ts` [new]
- `src/utils/phone.ts` [new]
- `src/utils/index.ts` [new]
- `test/schemas/phone.test.ts` [new]
- `test/schemas/email.test.ts` [new]
- `test/schemas/pagination.test.ts` [new]
- `test/schemas/api-response.test.ts` [new]
- `test/utils/phone.test.ts` [new]

### `apps/api` [modify]
- `package.json` [modify] — add `@repo/shared` dep

### `apps/web` [modify]
- `package.json` [modify] — add `@repo/shared` dep
