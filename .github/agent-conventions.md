# EventKart Workflow Conventions

This shared Markdown reference keeps reusable EventKart development conventions in one place. It remains at `.github\agent-conventions.md` for compatibility, but it does **not** define the active workflow entrypoint.

## Canonical Feature Workflow

The canonical EventKart feature workflow is the single-prompt Anvil workflow:

```text
.github\prompts\eventkart-dev-workflow.prompt.md
```

Run that prompt inside the existing `anvil` agent. The workflow stays in Anvil for intake, scope resolution, planning, implementation, validation, review, fix loops, progress documentation, and final summary.

Do not treat this document as an orchestration spec. It is a conventions reference for the Anvil prompt and for manual Copilot CLI runs.

## Copilot CLI Runtime

- Use `/env` to verify loaded repo instructions, hooks, skills, and MCP servers.
- Use `/skills list` to verify expected skills are available.
- Use `/tasks` to inspect background task state when subtasks are running.
- Use Windows paths for local file references in this repository.
- In autopilot, continue with safe reversible defaults and do not wait for plan approval, fix approval, or clarification.

### `/fleet` policy

Use `/fleet` only for independent work that can safely run in parallel:

- Independent codebase research.
- Independent validation or reproduction attempts.
- Independent non-editing review passes.
- Log or test-output analysis that does not modify shared files.

Avoid `/fleet` for:

- Shared-file edits.
- Database migrations.
- Sequential feature implementation.
- Conflict-prone refactors.
- Any change where ordering, shared state, or a single source of truth matters.

## Stack

| Area               | Convention                                        |
| ------------------ | ------------------------------------------------- |
| Monorepo           | pnpm 10 + Turborepo                               |
| Frontend           | TanStack Start, React 19, Vite — `apps\web`       |
| Backend            | Fastify v5, TypeScript — `apps\api`               |
| Database           | Drizzle ORM + PostgreSQL — `packages\db`          |
| Shared contracts   | Zod schemas, types, constants — `packages\shared` |
| UI                 | shadcn/ui, Tailwind CSS v4 — `packages\ui`        |
| Testing            | Vitest                                            |
| Formatting/linting | Biome for TS/JS; Prettier only for Markdown       |

## Non-Negotiable EventKart Rules

| Rule                  | Requirement                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| pnpm only             | Never use npm or yarn.                                                                                                |
| Biome                 | Use Biome for TS/JS linting and formatting. Do not introduce ESLint or Prettier for code files.                       |
| Markdown formatting   | Prettier is allowed only for Markdown.                                                                                |
| Vitest                | Do not introduce Jest.                                                                                                |
| Tailwind v4           | CSS-first configuration; do not create `tailwind.config.js`.                                                          |
| TypeScript strictness | Preserve strict TS, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.             |
| React Compiler        | Avoid manual `useMemo`/`useCallback` unless profiling shows it is needed.                                             |
| App boundaries        | `apps\web` and `apps\api` communicate by HTTP only; never import directly between them.                               |
| Shared UI             | Shared UI belongs in `packages\ui`; do not duplicate reusable components in apps.                                     |
| Env access            | API uses `fastify.config.*`; web uses `publicEnv`/`serverEnv`; never read raw `import.meta.env` directly in web code. |
| Server enforcement    | Security and access control must be enforced at the API layer, never UI-only.                                         |

## Package Boundaries

| Package                      | Purpose                                       | Import/use                                                               |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| `apps\web`                   | TanStack Start frontend, SSR + CSR            | Browser/server functions call API over configured URLs.                  |
| `apps\api`                   | Fastify REST API                              | Owns HTTP routes, auth, authorization, and server-side enforcement.      |
| `packages\db`                | Drizzle schema, migrations, database helpers  | Use for database schema/model work.                                      |
| `packages\shared`            | Zod schemas, shared types, constants          | Share API contracts and cross-workspace domain types.                    |
| `packages\ui`                | Shared shadcn/ui components, hooks, utilities | Import as `@repo/ui/components/*`, `@repo/ui/lib/*`, `@repo/ui/hooks/*`. |
| `packages\typescript-config` | Shared tsconfig presets                       | Extend from workspace packages.                                          |

Backend modules live under `apps\api\src\modules\<domain>\` and usually contain `routes.ts`, `service.ts`, `schemas.ts`, and `types.ts`.

Frontend features live under `apps\web\src\features\<domain>\` and usually contain `api.ts`, `queries.ts`, `components\`, `hooks.ts`, and `types.ts`.

## Workspace Commands

Run commands from the repository root with pnpm:

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm test
```

Prefer scoped commands for changed workspaces:

```sh
pnpm --filter api dev
pnpm --filter api test
pnpm --filter api lint
pnpm --filter api check-types

pnpm --filter web dev
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web check-types
```

Run single Vitest files with workspace filters, for example:

```sh
pnpm --filter api exec vitest run test/routes/health.test.ts
pnpm --filter web exec vitest run src/components/Button.test.tsx
```

## Reference Docs

Read the relevant local docs before coding:

| File                                                     | Purpose                                          |
| -------------------------------------------------------- | ------------------------------------------------ |
| `.github\copilot-instructions.md`                        | Repo-wide rules.                                 |
| `.github\prompts\eventkart-dev-workflow.prompt.md`       | Canonical Anvil single-prompt feature workflow.  |
| `.github\instructions\fastify-backend.instructions.md`   | API patterns, auth, validation, testing.         |
| `.github\instructions\tanstack-start.instructions.md`    | Web patterns, SSR modes, routing, data loading.  |
| `.github\instructions\progress-tracking.instructions.md` | Progress tracking rules.                         |
| `docs\v1-implementation-plan.md`                         | Feature specs, IDs, dependencies, current state. |
| `docs\requirements.md`                                   | Product requirements and F-IDs.                  |
| `docs\architecture.md`                                   | System architecture decisions.                   |
| Active `docs\impl-plan\*.md`                             | Current implementation scope, tasks, ledgers.    |

When current library behavior matters, use Context7 or official docs for Fastify v5, Drizzle, TanStack Start/Router/Query/Form, Zod v4, BullMQ, Razorpay, Resend, Tailwind v4, and shadcn/ui. If external docs conflict with repo instructions, follow the safer repo-compatible path and record the divergence in the ledger.

## Skills

Load or invoke applicable skills when available:

| Domain                                      | Skill                                                             |
| ------------------------------------------- | ----------------------------------------------------------------- |
| API routes/plugins                          | `fastify-best-practices`                                          |
| Database schema/migrations                  | `drizzle`, `postgres`                                             |
| Frontend routes/app architecture            | `tanstack-start-best-practices`, `tanstack-router-best-practices` |
| Forms                                       | `tanstack-form`                                                   |
| Data fetching/caching                       | `tanstack-query`                                                  |
| Zod schemas                                 | `zod`                                                             |
| UI and theming                              | `tailwind-v4-shadcn`, `shadcn-ui`                                 |
| Redis/queues                                | `redis-development`                                               |
| Auth, user input, payments, security review | `owasp-security`                                                  |
| Tests                                       | `vitest`                                                          |
| Monorepo workflow                           | `turborepo`                                                       |

If a skill is unavailable, continue using local instructions and current library docs.

## Autopilot Decision Policy

Use this policy for autopilot-safe decisions:

| Decision type                         | Behavior                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing project convention covers it | Follow the convention and continue.                                                                                                                                                 |
| Multiple reversible options exist     | Choose the smallest production-ready option that preserves package boundaries and testability; log the choice.                                                                      |
| Missing prerequisite feature          | Include prerequisite work if required for the requested feature and feasible in the same vertical slice; otherwise create only a narrow stub when docs already define the contract. |
| Scope is large                        | Split into sequential vertical slices and use `/fleet` only for independent research, validation, or review subtasks.                                                               |
| Business behavior is ambiguous        | Implement the conservative behavior that minimizes data exposure, financial risk, and user-visible surprise; add an assumption and follow-up note.                                  |
| New dependency is tempting            | Avoid it if existing packages or a simple local helper are sufficient. If unavoidable, install with pnpm and document why.                                                          |
| Validation failure has multiple fixes | Prefer the fix that preserves existing behavior and narrows the change; document the reason.                                                                                        |
| Security/privacy risk is unclear      | Choose the stricter security/privacy option and continue if reversible. Stop only when no safe implementation exists.                                                               |
| Pushback is triggered                 | Do not request confirmation in autopilot. If reversible, choose the safer/smaller implementation and log it. If irreversible or unsafe, stop as blocked.                            |

Record every non-obvious decision in `## Workflow Run Ledger`, `## Verification Ledger`, or the active task ledger.

## Risk Gates

Use these gates for EventKart feature work unless the task is documentation-only.

### Task Sizing

| Size   | Examples                                                                                      | Required gates                                                                                      |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Small  | Typo, doc tweak, one-file config tweak                                                        | Quick diagnostics/format check only; adversarial review optional.                                   |
| Medium | Bug fix, single feature slice, moderate refactor                                              | Baseline capture, verification ledger, at least one review pass, evidence bundle.                   |
| Large  | Multi-workspace feature, auth, payments, privacy-sensitive data, schema migration, queue work | Baseline capture, verification ledger, multiple review passes or `/fleet` review, readiness checks. |
| Red    | Auth, crypto, payments, data deletion, schema migrations, concurrency, public API surface     | Treat as Large even if the diff is small.                                                           |

### Git Hygiene

Before editing Medium/Large/Red work:

1. Check `git status --short`.
2. Check the current branch when branch or commit changes are in scope.
3. Identify unrelated dirty files.
4. Continue only when changes can be isolated.
5. Avoid unrelated dirty files.
6. Stop as blocked if unrelated dirty files overlap the requested scope and proceeding risks overwriting user work.
7. Create a feature branch only when the prompt or repo workflow explicitly requests it.

### Session-History Recall

Before planning Medium/Large/Red work, query prior session history when available:

1. Search previous sessions touching the same files/modules.
2. Search for prior regressions, reverted changes, failed validations, or fragile areas.
3. Record relevant history under `## Autopilot Assumptions`, `## Workflow Run Ledger`, or the active task ledger.

### Baseline Capture

Before changing code for Medium/Large/Red work:

1. Capture diagnostics for files expected to change when IDE/LSP diagnostics are available.
2. Run the smallest relevant existing validation command that establishes current state.
3. Record pre-existing failures separately from workflow-introduced failures.

### Verification Cascade

After implementation:

1. Run diagnostics for changed files and importers when available.
2. Run syntax/parse/type checks appropriate to affected workspaces.
3. Run lint for affected workspaces or changed files.
4. Run relevant tests.
5. If no runtime signal exists, run a lightweight import/load/smoke check or record why it is infeasible.

Minimum after-change signals:

- Medium: at least 2 verification rows.
- Large/Red: at least 3 verification rows plus review rows.

### Review and Fix Loop

Before final output for Medium/Large/Red work:

1. Capture the diff for review.
2. Run at least one review pass for Medium work.
3. Run multiple review passes for Large/Red work; `/fleet` is acceptable only for independent, non-editing review.
4. Fix real findings and rerun relevant verification.
5. Stop after 2 review/fix rounds if unresolved findings remain; report blockers or known risks.

### Operational Readiness

For Large/Red work, verify:

1. Errors are surfaced or logged with useful context.
2. External dependency failures degrade safely.
3. Secrets/configuration are not hardcoded.
4. Sensitive data is not logged.
5. Rollback path is documented.

## Workflow Run Ledger Template

Add this table to active implementation plans when progress tracking is in scope:

```markdown
## Workflow Run Ledger

| Phase          | Owner | Status  | Size/Risk | Decisions / assumptions | Evidence |
| -------------- | ----- | ------- | --------- | ----------------------- | -------- |
| Intake         | Anvil | Pending |           |                         |          |
| Git hygiene    | Anvil | Pending |           |                         |          |
| Baseline       | Anvil | Pending |           |                         |          |
| Plan           | Anvil | Pending |           |                         |          |
| Plan review    | Anvil | Pending |           |                         |          |
| Implementation | Anvil | Pending |           |                         |          |
| Verification   | Anvil | Pending |           |                         |          |
| Review         | Anvil | Pending |           |                         |          |
| Fix loop       | Anvil | Pending |           |                         |          |
| Final evidence | Anvil | Pending |           |                         |          |
```

## Verification Ledger

Record verification as evidence, not prose. Prefer a session SQL table when available; otherwise mirror the rows in the active implementation plan under `## Verification Ledger`.

```sql
CREATE TABLE IF NOT EXISTS eventkart_workflow_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('baseline', 'after', 'review', 'readiness')),
    check_name TEXT NOT NULL,
    tool TEXT NOT NULL,
    command TEXT,
    exit_code INTEGER,
    output_snippet TEXT,
    passed INTEGER NOT NULL CHECK(passed IN (0, 1)),
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Markdown fallback:

```markdown
## Verification Ledger

| Phase | Check | Tool/command | Exit code | Passed | Evidence snippet |
| ----- | ----- | ------------ | --------- | ------ | ---------------- |
```

If a check is not in the ledger, the final response must not claim it happened.

## Progress Tracking

When implementing work from `docs\impl-plan\` or `docs\v1-implementation-plan.md`:

1. Update `progress.md`.
2. Update `docs\v1-implementation-plan.md` current state and feature completion markers when applicable.
3. Update the active `docs\impl-plan\*.md` task table with completion markers and dates.
4. Archive a completed implementation plan only when all tasks in that plan are complete.

Do not update progress documents for small discussions, exploratory work, or unrelated fixes.

## Final Evidence Bundle

Final responses for Medium/Large/Red work should include:

1. Task ID, task size, and risk level.
2. What changed.
3. Baseline result summary.
4. After-change verification summary.
5. Review findings and fixes.
6. Remaining uncertainty, blockers, or known risks.
7. Rollback guidance.

For Small work, provide a concise summary and the exact validation performed.

## Safety Blockers

Stop as blocked, preserve user work, and report exact evidence when:

1. A required secret, credential, or external service is unavailable.
2. The task requires an irreversible external side effect not explicitly requested, such as production deploy, real payment capture/refund, destructive data deletion, or force push.
3. A safety hook denies an operation.
4. The repository has overlapping unrelated changes that cannot be safely isolated.
5. The max autopilot continuation or review-loop cap is reached.
6. No safe reversible implementation exists for a security/privacy-sensitive ambiguity.

Never silently run high-risk destructive operations in autopilot, including `git reset --hard`, force push, deleting `.env*`, deleting Drizzle migration history, broad recursive deletes of the repo/root, direct production deploys, real payment capture/refund commands, or npm/yarn commands in this pnpm repo.

## Branching and Commits

- Branch names: `feat/<module>-<short-description>` when branch creation is requested by the workflow.
- Commit messages: conventional commits such as `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, or `docs:`.
- Keep one feature per branch and focused PRs.
- When creating commits through Copilot CLI, include the required Copilot co-author trailer.
