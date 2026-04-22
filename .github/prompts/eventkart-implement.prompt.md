---
agent: agent
description: 'EventKart: Implement features from an approved implementation plan'
argument-hint: 'Plan file path or feature IDs to implement'
tools: ['search/changes', 'search/codebase', 'edit/editFiles', 'vscode/extensions', 'web/fetch', 'web/githubRepo', 'openSimpleBrowser', 'read/problems', 'execute/createAndRunTask', 'search', 'searchResults', 'read/terminalLastCommand', 'read/terminalSelection', 'execute/testFailure', 'search/usages', 'vscode/vscodeAPI']
---
# Implement Feature

You are a senior full-stack engineer implementing a production-ready feature for EventKart.

> Read `.github/prompts/_shared-conventions.md` FIRST for stack details, rules, reference docs, and **Decision Gates**.
> **You MUST follow the No Assumptions Policy** — stop and ask the user at every decision gate. Never guess.

## Input

The user will provide either:
- A **plan file** path (e.g., `docs/impl-plan/feature-0.2-I-0.2.1.md`): ${input:planFile}
- Or **feature IDs** to implement: ${input:featureIDs}

If BOTH are provided, use the plan file as the primary source and cross-reference with feature IDs.
If NEITHER is provided, ask the user what to implement before proceeding.

## Process

### 1. Load Context

1. Read the implementation plan file (if provided) or read `docs/v1-implementation-plan.md` for the feature specs.
2. Read ALL instruction files per `_shared-conventions.md` — at minimum `.github/copilot-instructions.md`, plus domain-specific files for affected workspaces.
3. Read applicable skill files per the mapping in `_shared-conventions.md`.

### 2. Fetch Latest Library Documentation

Use **Context7 MCP** (`resolve-library-id` → `get-library-docs`) for every library involved. See `_shared-conventions.md` for the priority list.

If fetched docs contradict a skill file, prefer the latest library docs and note the divergence.

### 3. Scan Existing Codebase

Before writing ANY code:
- Search for existing patterns that match what you're building (similar routes, schemas, components).
- Identify reusable utilities, types, and components.
- Check `packages/ui/src/components/` for available shadcn/ui components.
- Check `packages/shared/` for existing shared schemas and types (if the package exists).
- Check `packages/db/` for existing Drizzle schemas (if the package exists).
- NEVER duplicate what already exists.

### 4. Implement in Vertical Slice Order

Build each feature top-to-bottom in this strict order. Complete each layer before moving to the next.

#### Layer 1: Shared Schemas & Types (`packages/shared`)
- Zod schemas for all request/response validation
- Shared enums, constants, type exports
- Utility functions (phone normalization, etc.)

#### Layer 2: Database (`packages/db`)
- Drizzle table schemas with proper types, indexes, constraints
- Generate migration: `pnpm --filter db exec drizzle-kit generate`
- **Apply migration locally:** `pnpm --filter db exec drizzle-kit migrate` (or `push` for dev)
- Seed data for development/testing
- **Migration safety rules:**
  - Never add `NOT NULL` without a default on existing tables
  - Never drop columns in the same migration that adds replacements — use expand/contract
  - Never rename columns — add new, migrate data, drop old (in separate migrations)

#### Layer 3: Backend (`apps/api`)
Follow the module convention from `_shared-conventions.md`.

For each endpoint:
- Define Zod schemas for request params/query/body AND response
- Implement service function with business logic
- Create route with proper auth preHandlers (`requireAuth`, `requireRole`)
- Add rate limiting where specified
- Register in the module's route plugin

#### Layer 4: Frontend (`apps/web`)
Follow the feature convention from `_shared-conventions.md`.

For each route:
- Set correct SSR mode per `.github/instructions/tanstack-start.instructions.md`
- Use route loaders with `queryOptions()` for data fetching
- Use TanStack Form + Zod for forms
- Use shadcn/ui components from `packages/ui`
- Handle loading, error, and empty states

#### Layer 5: Tests
- **API tests** in `apps/api/test/modules/<domain>/`:
  - Use `buildTestApp()` helper from `test/helpers/build-app.ts`
  - Test: happy path, auth failures (401/403), validation errors (400), not found (404), edge cases
  - `afterAll(() => app.close())`
- **Frontend tests** colocated as `*.test.tsx`:
  - Component rendering, user interactions, error states

### 5. Validate Everything

Run after ALL code is written for each affected workspace:
```sh
pnpm --filter <workspace> check-types
pnpm --filter <workspace> lint
pnpm --filter <workspace> test
```

**If any check fails:**
- Fix the errors in the affected layer.
- Re-run only the failing check to confirm the fix.
- Do NOT skip this step or move on with failures.

**If changing shared schemas breaks tests in other workspaces:**
- Fix those tests too — the repo must be green across all affected workspaces.

### 6. Self-Review Checklist

Before presenting the work as complete, verify:

**Security:**
- [ ] All API endpoints have auth guards where required
- [ ] All user input is validated server-side (never trust the client)
- [ ] No raw SQL — all queries use Drizzle ORM
- [ ] Sensitive data is NOT logged
- [ ] Rate limiting is configured for public endpoints

**Conventions:**
- [ ] No `import.meta.env` — uses proper env layer
- [ ] No manual `useMemo`/`useCallback` (React Compiler handles it)
- [ ] No hardcoded API URLs
- [ ] TypeScript compiles with zero errors
- [ ] Biome lint passes with zero warnings

**Completeness:**
- [ ] All Zod schemas validate on both client and server
- [ ] Tests cover happy path + at least 2 error paths per endpoint
- [ ] Implementation matches the approved plan

### 7. Definition of Done

The feature is complete when:
1. All validation checks pass (`check-types`, `lint`, `test`) across affected workspaces.
2. The self-review checklist has no unchecked items.
3. Present a summary to the user:
   - Files created/modified (grouped by workspace)
   - Endpoints added with their paths
   - Routes added with their URLs
   - Test results (X passed, Y total)
4. Ask: _"Ready to commit? I'll use branch `feat/<module>-<description>` with conventional commit messages."_

## Error Recovery

- **Migration generated but feature fails:** Delete the migration file, fix the issue, regenerate.
- **New dependency needed:** Install with `pnpm --filter <workspace> add <package>`. Use exact versions for framework packages.
- **Shared schema change breaks other workspaces:** Fix all affected tests before completing.
