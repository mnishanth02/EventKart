---
agent: anvil
description: "EventKart: Anvil single-prompt dev workflow for intake, planning, implementation, validation, review, and fix loops"
argument-hint: "Feature IDs, plan path, bug, refactor, or implementation scope"
---

# EventKart Dev Workflow

Execute the EventKart development lifecycle end-to-end in one run: intake → plan → plan review → implementation → validation → code review → fix loop → progress docs → final summary.

## Project Context

Do not restate repo conventions in this prompt. Consult the existing sources of truth and follow them:

- `.github/copilot-instructions.md` — repo-wide rules (package boundaries, tooling guardrails, env handling, commands).
- `.github/instructions/fastify-backend.instructions.md` — applies to `apps/api/**`.
- `.github/instructions/tanstack-start.instructions.md` — applies to `apps/web/**`.
- `.github/instructions/progress-tracking.instructions.md` — applies to progress docs.
- `docs/v1-implementation-plan.md` — feature ID source of truth and current state.
- `docs/impl-plan/` — active per-feature implementation plans.
- `docs/requirements.md`, `docs/architecture.md` — product and architecture context when needed.
- `progress.md` — running implementation log.

Use current official docs (or Context7) when library behavior materially affects correctness.

## Intake

Accept any of these inputs:

- Feature IDs or module names from `docs/v1-implementation-plan.md`.
- An active plan path under `docs/impl-plan/`.
- A bug, refactor, review, or casual implementation request.
- A list of changed files.

For every request, identify:

1. The requested outcome and acceptance criteria.
2. The source of truth (feature spec, active plan, user text, diff, or bug report).
3. The affected workspaces (`apps/api`, `apps/web`, `packages/shared`, `packages/db`, `packages/ui`).

## Scope and Prerequisite Resolution

For feature IDs or planned work:

1. Locate each requested feature in `docs/v1-implementation-plan.md` and the matching `docs/impl-plan/*.md`.
2. Trace prerequisite features and dependencies.
3. Inspect the codebase to confirm which prerequisites already exist.
4. If a prerequisite is missing:
   - Include it in the same vertical slice when required and feasible.
   - Create a narrow stub only when repo docs already define the contract and the requested feature can safely proceed.
   - Stop as blocked only when no safe reversible path exists.
5. Record decisions and assumptions in the active implementation plan or run summary.

For non-feature work, define the smallest safe scope that satisfies the request and preserves package boundaries.

Implement by vertical slice in this order: shared contracts → database → backend → frontend → tests → docs.

## Elevate Rigor When

The change touches any of:

- Authentication, sessions, or RBAC.
- Payments, refunds, payouts, or financial state.
- Personal/sensitive data or PII handling.
- Public API surface (request/response contracts, status codes).
- Database migrations or destructive schema changes.
- Data deletion or bulk mutations.
- Concurrency, queues, idempotency, or distributed state.
- Security controls (CSRF, headers, secrets, allowlists).

For these, use stricter planning, an independent code-review pass, explicit rollback or expand/contract reasoning, and at minimum a security-focused validation step. When in doubt, treat as elevated.

## Workflow Phases (sequential)

### 1. Baseline and Git Hygiene

- Check `git status --short`. Identify unrelated dirty files and avoid editing them.
- Capture relevant baseline diagnostics when affordable; record any pre-existing failures separately from failures introduced by this run.

### 2. Plan

- Produce an implementation plan before editing code.
- For planned feature work, create or update the active plan under `docs/impl-plan/`.
- Include exact file paths, layer order (vertical slice), schema/API/component details, test plan, validation commands, rollback notes, risks, and assumptions.

### 3. Plan Review

- Review the plan against scope, acceptance criteria, prerequisites, package boundaries, env rules, security/privacy/performance/migration risks, and test coverage.
- Fix the plan before coding if review finds blocking gaps.

### 4. Implementation

- Make surgical changes that fully satisfy the request.
- Reuse existing patterns, components, hooks, schemas, services, and utilities before creating new ones.
- Implement by vertical slice and keep each layer wired before moving on.
- Add or update tests for changed behavior.
- Do not commit secrets or hardcode API URLs. Add dependencies only when existing packages are insufficient.

### 5. Validation and Evidence

- Run scoped validation from the repo root using affected workspaces (e.g. `pnpm --filter <workspace> check-types|lint|test`). Use repo-wide commands only when the change is cross-cutting.
- For database changes, validate migration generation/application and document rollback or safe revert steps.
- Record evidence as command, scope, result, and a relevant output snippet. Never claim a check passed unless it actually ran and passed.

### 6. Code Review

- Review the completed diff against the request, acceptance criteria, the approved plan, package boundaries, security and access control, privacy, migration safety, performance and indexing, TypeScript strictness, test quality, and validation evidence.
- Skip style-only nits unless they materially affect maintainability or repo conventions.

### 7. Fix Loop

- Classify each finding as Critical, Improvement, or Nit.
- Fix Critical and meaningful Improvement findings within scope.
- Re-run targeted validation; re-review the affected diff.
- Stop after two review/fix rounds if findings remain unresolved; report blockers or residual risk.
- Do not broaden scope to unrelated cleanup during the fix loop.

### 8. Progress Docs

- Follow `.github/instructions/progress-tracking.instructions.md`. Update progress docs only when the work comes from `docs/impl-plan/` or `docs/v1-implementation-plan.md`. Skip progress updates for unrelated bug fixes, exploratory work, or standalone documentation changes.

### Escape Hatch (small reversible work only)

For trivial, low-risk changes — typo fixes, comment-only edits, single-file config tweaks, narrow doc edits — Plan Review (3) and Code Review (6) may be skipped. Baseline (1), Validation (5), and "do not touch unrelated dirty files" still apply. Anything matching the Elevate Rigor list does **not** qualify, regardless of diff size.

## Model Routing

When the runtime supports model switching, use:

| Phase          | Preferred model |
| -------------- | --------------- |
| Planning       | Claude Opus 4.7 (High reasoning) |
| Plan review    | GPT-5.5 High    |
| Implementation | GPT-5.5 High    |
| Code review    | GPT-5.5 High    |

If mid-run switching is unavailable, continue with the current model and note the limitation in the final summary.

## Safety Blockers

Stop as blocked and preserve user work when:

- Required secrets, credentials, or external services are unavailable.
- The task requires an irreversible external side effect not explicitly requested.
- A destructive migration, production deployment, real payment operation, force push, or broad delete would be required.
- Unrelated dirty files overlap the requested scope and cannot be safely avoided.
- No safe reversible implementation exists for a security/privacy-sensitive ambiguity.
- Validation cannot be meaningfully run and no alternative evidence can be collected.

## Final Response Checklist

- What was completed.
- Files changed, grouped by workspace or doc area.
- Validation run and results; explicitly state any checks not run.
- Review and fix-loop outcome.
- Progress docs updated, or why they were not in scope.
- Remaining blockers, risks, assumptions, or follow-up work — and whether the task is fully done.
