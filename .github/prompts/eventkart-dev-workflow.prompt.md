---
agent: anvil
description: "EventKart: Anvil single-prompt dev workflow for intake, planning, implementation, validation, review, and fix loops"
argument-hint: "Feature IDs, plan path, bug, refactor, or implementation scope"
---

# EventKart Dev Workflow — Anvil Single Prompt

You are running inside the existing **Anvil** agent. Execute the full EventKart development lifecycle in one run: intake, scope resolution, risk classification, planning, plan review, implementation, validation/evidence, code review, fix loops, progress documentation, and final summary.

## Non-Negotiable Orchestration Rules

- This prompt replaces the external multi-agent workflow handoff for the current run. Keep the workflow inside Anvil.
- Use `/fleet` only for independent internal subtasks such as parallel research, independent review, or independent validation.
- Do **not** use `/fleet` for shared-file edits, sequential migrations, feature implementation that touches the same files, or any task where ordering matters.
- Use Windows paths in local references.
- Protect unrelated user work. Check the current diff before edits and do not modify unrelated dirty files.

## Runtime Model Routing

When the runtime supports model switching, use:

| Phase | Preferred model |
| ----- | --------------- |
| Planning | Opus 4.6 |
| Plan review | GPT-5.5 |
| Implementation | GPT-5.5 |
| Code review | GPT-5.5 |

Prompt files cannot guarantee mid-run model switching. If switching is unavailable, continue with the current Anvil model and record the limitation in the run ledger and final summary. Never stop solely because model switching is unavailable.

## EventKart Context and Boundaries

EventKart is a pnpm + Turborepo monorepo for an event ticketing platform.

| Area | Location | Rules |
| ---- | -------- | ----- |
| Frontend | `apps\web` | TanStack Start, React 19, Vite. Feature-first under `apps\web\src\features\<domain>\`. |
| Backend | `apps\api` | Fastify v5 TypeScript API. Modular monolith under `apps\api\src\modules\<domain>\`. |
| Shared contracts | `packages\shared` | Zod schemas, shared types, constants, and cross-workspace API contracts. |
| Database | `packages\db` | Drizzle schema, migrations, seeds, and database helpers. |
| Shared UI | `packages\ui` | shadcn/ui components, shared hooks, utilities, and reusable UI primitives. |

Hard boundaries:

- `apps\web` and `apps\api` communicate over HTTP only. Never import directly between them.
- Put shared contracts in `packages\shared`; do not duplicate request/response schemas across apps.
- Put database schema and migrations in `packages\db`.
- Put reusable UI in `packages\ui`; app-specific or route-aware composites stay in `apps\web`.
- Web environment access must go through `publicEnv` or `serverEnv`; never read raw `import.meta.env` directly in web code.
- API environment access must go through `fastify.config.*`.

Tooling guardrails:

- Use `pnpm` only. Never use npm or yarn.
- Use Biome for TypeScript/JavaScript linting and formatting. Do not introduce ESLint or Prettier for code files.
- Use Prettier only for Markdown formatting when the repo already provides it.
- Use Vitest. Do not introduce Jest.
- Preserve strict TypeScript settings, including `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.
- Tailwind v4 is CSS-first. Do not create `tailwind.config.js`.
- Avoid manual `useMemo`/`useCallback` unless there is measured need beyond React Compiler.

## Intake

Accept any of these inputs:

- Feature IDs or module names from `docs\v1-implementation-plan.md`.
- An active plan path under `docs\impl-plan\`.
- A bug, refactor, review, validation, or implementation request.
- A list of changed files.

Start by identifying:

1. Requested outcome and acceptance criteria.
2. Source of truth: feature spec, active plan, user text, diff, or bug report.
3. Affected workspaces: `apps\api`, `apps\web`, `packages\shared`, `packages\db`, `packages\ui`.
4. Whether progress documents are in scope.
5. Whether the work touches auth, payments, public APIs, personal data, migrations, queues, concurrency, or external services.

For planned feature work, read the applicable local references before planning or editing:

- `.github\copilot-instructions.md`
- `.github\agent-conventions.md`
- `.github\instructions\fastify-backend.instructions.md` when `apps\api` is affected
- `.github\instructions\tanstack-start.instructions.md` when `apps\web` is affected
- `.github\instructions\progress-tracking.instructions.md` when updating progress docs
- `docs\v1-implementation-plan.md` when feature IDs/modules are involved
- active `docs\impl-plan\*.md` when a plan exists or is being executed
- `docs\requirements.md` and `docs\architecture.md` when product or architecture context matters

Use current official docs or Context7 when library behavior materially affects correctness.

## Scope and Prerequisite Resolution

For feature IDs or planned feature work:

1. Locate each requested feature in `docs\v1-implementation-plan.md`.
2. Trace prerequisite features and dependencies.
3. Inspect the codebase to determine which prerequisites are already implemented.
4. If a prerequisite is missing:
   - Include it in the same vertical slice when it is required and feasible.
   - Create a narrow stub only when repo docs already define the contract and the requested feature can safely proceed.
   - Stop as blocked only when no safe reversible path exists.
5. Record decisions and assumptions in the run ledger or active implementation plan.

For non-feature work, define the smallest safe scope that satisfies the request and preserves package boundaries.

## Risk Classification

Classify the task before planning:

| Tier | Examples | Required behavior |
| ---- | -------- | ----------------- |
| Small | Documentation-only change, typo, one-file config tweak, narrow non-risky fix | Compact inline plan, targeted validation, concise review. |
| Medium | Single feature slice, bug fix with tests, moderate refactor, one workspace plus shared contracts | Plan, plan review, implementation, validation/evidence, code review, fix loop. |
| Large | Multi-workspace feature, major refactor, broad UI/API change, queue or integration work | Full gates, baseline capture, detailed plan, stricter plan review, multiple validation signals, independent review. |
| Red | Auth, payments, personal/sensitive data, public API surface, database migrations, data deletion, concurrency, security controls | Treat as Large even if the diff is small; use stricter review and rollback checks. |

If in doubt, choose the higher tier.

## Lifecycle

### 1. Baseline and Git Hygiene

For Medium/Large/Red work:

1. Check `git status --short` and identify unrelated dirty files.
2. Capture relevant diagnostics when available.
3. Run the smallest existing validation command that establishes baseline when useful and affordable.
4. Record pre-existing failures separately from failures introduced by this run.

Small documentation-only work may skip expensive baseline commands, but still avoid unrelated dirty files.

### 2. Plan

Use Opus 4.6 for planning when runtime model switching is available.

Small work:

- Create a compact inline plan with files to touch and validation to run.

Medium/Large/Red work:

- Produce an implementation plan before editing code.
- For planned feature work, create or update the active plan under `docs\impl-plan\` only when appropriate for that feature workflow.
- Include exact file paths, layer order, schema/API/component details, test plan, validation commands, rollback notes, risks, and assumptions.
- Prefer vertical slices in this order: shared contracts → database → backend → frontend → tests → docs.
- For database work, include migration strategy and rollback expectations.

### 3. Plan Review

Use GPT-5.5 for plan review when available.

Review the plan before implementation:

- Confirm scope matches the request and acceptance criteria.
- Confirm prerequisites and dependencies are resolved.
- Check EventKart package boundaries and env rules.
- Check security, privacy, performance, and migration risks.
- Check test and validation coverage.
- For Large/Red work, use an independent internal review pass, optionally via `/fleet`, only if the review is independent and does not edit shared files.

Fix the plan before coding if review finds blocking gaps.

### 4. Implementation

Use GPT-5.5 for implementation when available.

Implementation rules:

- Make surgical changes that fully satisfy the request.
- Follow existing patterns before creating new abstractions.
- Reuse existing UI components, hooks, schemas, services, and utilities before adding new ones.
- Keep changes isolated to the approved scope.
- Implement by vertical slice and keep each layer wired before moving on.
- Add or update tests for changed behavior.
- Never commit secrets or hardcode API URLs.
- Do not add dependencies unless existing packages are insufficient; if needed, install with `pnpm --filter <workspace> add <package>` and document why.

Database/migration rules:

- Generate and apply migrations using existing `pnpm --filter db ...` commands.
- Avoid adding `NOT NULL` columns without defaults to existing tables.
- Avoid drop/rename in the same migration that introduces replacements; use expand/contract.
- Verify rollback or safe revert steps for migration changes.
- If migration validation fails, do not leave orphaned or unsafe migrations; fix and regenerate when appropriate.

### 5. Validation and Evidence

Run scoped validation from the repository root. Prefer affected workspace commands:

```sh
pnpm --filter <workspace> check-types
pnpm --filter <workspace> lint
pnpm --filter <workspace> test
```

Examples:

```sh
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api test

pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web test

pnpm --filter db check-types
pnpm --filter db lint
pnpm --filter db test
```

Use repo-wide commands (`pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build`) when the change is cross-cutting or workspace boundaries make scoped checks insufficient.

For database changes, also validate migration generation/application and document rollback or safe revert checks. If a rollback command exists in the repo, run the relevant rollback check; otherwise inspect the migration for reversibility/safe deploy behavior and state the limitation.

Record evidence as command, scope, result, and relevant output snippet. Do not claim a check passed unless it was actually run and passed.

### 6. Code Review

Use GPT-5.5 for code review when available.

Review the completed diff against:

- Request and acceptance criteria.
- Approved plan.
- EventKart package boundaries.
- Security and access control.
- Privacy and sensitive data handling.
- Migration safety.
- Performance and indexing.
- TypeScript strictness.
- Test quality.
- Validation evidence.

For Medium work, perform at least one review pass. For Large/Red work, perform stricter review and consider independent `/fleet` review for non-editing review only. Do not report style-only nits unless they materially affect maintainability or repo conventions.

### 7. Fix Loop

For each real finding:

1. Classify as Critical, Improvement, or Nit.
2. Fix Critical and meaningful Improvement findings within scope.
3. Re-run targeted validation for the changed area.
4. Re-review the affected diff.
5. Stop after two review/fix rounds if unresolved findings remain; report blockers or residual risk.

Do not broaden scope to unrelated cleanup during the fix loop.

### 8. Progress Docs

Update progress documents only for planned feature work from `docs\impl-plan\` or `docs\v1-implementation-plan.md`.

When in scope, update:

- `progress.md`
- `docs\v1-implementation-plan.md`
- the active `docs\impl-plan\*.md`

Progress updates must reflect completed tasks, current state, dates/status markers, validation evidence, and known follow-ups. Do not update progress docs for unrelated bugs, exploratory work, or standalone documentation changes.

## Safety Blockers

Stop as blocked and preserve user work when:

- Required secrets, credentials, or external services are unavailable.
- The task requires an irreversible external side effect not explicitly requested.
- A destructive migration, production deployment, real payment operation, force push, or broad delete would be required.
- Unrelated dirty files overlap the requested scope and cannot be safely avoided.
- No safe reversible implementation exists for a security/privacy-sensitive ambiguity.
- Validation cannot be meaningfully run and no alternative evidence can be collected.

## Final Response Requirements

Keep the final response concise but evidence-based. Include:

1. What was completed.
2. Files changed, grouped by workspace or documentation area.
3. Validation run and results; explicitly state any checks not run.
4. Review/fix-loop outcome.
5. Progress docs updated, or why they were not in scope.
6. Remaining blockers, risks, assumptions, or follow-up work.
7. Whether the task is fully done or needs more work.

For Small work, a short summary plus exact validation is sufficient. For Medium/Large/Red work, include the risk tier and the most important evidence.
