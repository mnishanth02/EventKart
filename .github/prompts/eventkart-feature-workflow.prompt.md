---
agent: agent
description: 'EventKart: End-to-end feature workflow — plan, implement, and review features from v1-implementation-plan.md'
argument-hint: 'Feature IDs, module name, or implementation scope to build'
tools: ['search/changes', 'search/codebase', 'edit/editFiles', 'vscode/extensions', 'web/fetch', 'web/githubRepo', 'openSimpleBrowser', 'read/problems', 'execute/createAndRunTask', 'search', 'searchResults', 'read/terminalLastCommand', 'read/terminalSelection', 'execute/testFailure', 'search/usages', 'vscode/vscodeAPI']
---
# EventKart Feature Workflow

You are building a production-ready feature for EventKart — an event ticketing platform built as a pnpm + Turborepo monorepo (TanStack Start frontend, Fastify v5 API, shared packages).

> **This is an orchestrator prompt.** It delegates to the plan, implement, and review phases.
> Read `.github/prompts/_shared-conventions.md` FIRST for stack details, rules, reference docs, and **Decision Gates**.
> **You MUST follow the No Assumptions Policy** — stop and ask the user at every decision gate. Never guess.

## Input

The user will provide one or more **feature IDs** (e.g., `I-0.2.1`, `I-1.2.3`) or a **module name** (e.g., "Module 0.2: Authentication & Identity") from `docs/v1-implementation-plan.md`.

## Phase 1: Scope & Prerequisites

1. Read `docs/v1-implementation-plan.md` and locate the requested feature(s).
2. Trace ALL **prerequisite features** — walk the full dependency chain.
3. Scan the current codebase to determine which prerequisites are already implemented.
4. **If prerequisites are missing:**
   - List them explicitly with their feature IDs.
   - Ask the user: _"These prerequisites are not implemented yet: [list]. Should I (a) include them in the plan, (b) stub them with minimal interfaces, or (c) stop and build them first?"_
   - Do NOT proceed until the user decides.
5. Identify affected workspaces: `apps/api`, `apps/web`, `packages/shared`, `packages/db`, `packages/ui`.
6. List the database tables, API endpoints, and UI routes involved.

## Phase 2: Plan

Follow the planning process defined in `.github/prompts/eventkart-plan.prompt.md`.

- Create a detailed implementation plan at `docs/impl-plan/feature-<module>-<feature-ids>.md`.
- Present the plan to the user for review.
- **Wait for explicit approval** before proceeding to implementation.

## Phase 3: Implement

Follow the implementation process defined in `.github/prompts/eventkart-implement.prompt.md`.

- Pass the approved plan file path as input.
- Build each feature as a vertical slice (shared → db → backend → frontend → tests).
- Validate with `check-types`, `lint`, and `test` after implementation.

## Phase 4: Review

Follow the review process defined in `.github/prompts/eventkart-review.prompt.md`.

- Self-review the implemented changes against the plan.
- Report findings using the standard review format (Critical / Improvements / Nits).
- Fix any critical or improvement issues before presenting as complete.

## Phase 5: Wrap Up

After all phases complete:
1. Summarize what was built (endpoints, routes, schemas, tests).
2. List any known limitations or follow-up work.
3. Ask: _"Should I commit these changes and create a PR?"_
   - If yes, use the branching convention from `_shared-conventions.md`.
   - PR title: `feat(<module>): <short description>`
   - PR body: summary of changes, test results, and any notes.

## Error Recovery

- **If validation fails (check-types/lint/test):** Fix errors in the affected layer. Re-run validation. Do NOT move to the next phase until all checks pass.
- **If a migration is generated but the feature fails validation:** Delete the migration file and regenerate after fixing the issue — never leave orphaned migrations.
- **If existing tests in other workspaces break due to shared schema changes:** Fix those tests as part of the implementation. Do NOT leave the repo in a broken state.
