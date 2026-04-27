# Plan: GitHub Copilot CLI Agent Workflow for EventKart

> **Status:** In progress — custom agents/hooks created and static workflow validation complete; prompt deletion is deferred until CLI dry-run and real feature-run verification pass
> **Date:** 2026-04-27
> **Scope:** Replace prompt-based feature workflow with a Copilot CLI-native custom-agent workflow that supports autopilot and `/fleet`.

---

## TL;DR

Build a **Copilot CLI-first workflow** around repository custom agents in `.github/agents/`, not VS Code prompt files or VS Code-only handoff metadata.

The primary user entrypoint should be one custom agent:

```sh
copilot --experimental --agent=eventkart-workflow --mode autopilot --allow-all --no-ask-user --max-autopilot-continues 250 -p "/fleet Implement I-1.2.3 end-to-end for EventKart. Create the plan, review it, implement it, review the code, fix review findings, update progress docs, and stop only when complete or blocked by a non-recoverable safety issue."
```

Interactive equivalent:

```sh
copilot --experimental --allow-all --max-autopilot-continues 250
/agent eventkart-workflow
# Press Shift+Tab until autopilot mode is active.
/fleet Implement I-1.2.3 end-to-end for EventKart. Create the plan, review it, implement it, review the code, fix review findings, update progress docs, and stop only when complete or blocked by a non-recoverable safety issue.
```

The workflow must **not wait for plan approval, fix approval, or clarification** when launched in autopilot mode. Instead, agents use an explicit autopilot decision policy: choose the safest reversible default, document assumptions in the plan/run ledger, continue, and only stop for non-recoverable blockers or unsafe irreversible actions.

---

## Research Findings

| Area                      | Finding                                                                                                                                                                                                                                                                | Plan impact                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copilot CLI custom agents | CLI supports custom agents from `.github/agents/*.agent.md`, `~/.copilot/agents`, and org/enterprise agent locations. Agents can be selected with `/agent`, referenced in prompts, or passed with `--agent=<name>`.                                                    | Use repository-level `.github/agents/` files as the durable workflow surface.                                                                                   |
| Agent frontmatter         | Supported properties include `name`, `description`, `target`, `tools`, `model`, `disable-model-invocation`, `user-invocable`, `mcp-servers`, and `metadata`. Tool aliases include `read`, `search`, `edit`, `execute`, `agent`, and `web`.                             | Replace VS Code tool IDs like `search/codebase` and `execute/createAndRunTask` with CLI-compatible aliases.                                                     |
| Handoffs                  | The GitHub custom-agent reference notes VS Code `handoffs` are not supported for GitHub Copilot and are ignored for compatibility. CLI docs describe agent invocation and subagent delegation, but not declarative `send: true` handoffs.                              | Remove declarative handoff assumptions. Make the primary workflow agent orchestrate phases through instructions, the `agent` tool, and `/fleet`.                |
| Autopilot                 | `--mode autopilot` or `--autopilot` lets Copilot continue autonomously. `--allow-all`/`--yolo` grants tools, paths, and URLs. `--no-ask-user` disables questions. `--max-autopilot-continues` caps loops.                                                              | Use all four flags for seamless handoff: autopilot + all permissions + no ask-user + bounded continuations.                                                     |
| `/fleet`                  | `/fleet` lets the main agent split independent subtasks into parallel subagents. Custom agents may be used automatically or explicitly via `@agent-name` in prompts.                                                                                                   | Use `/fleet` for research, independent test work, and independent review tasks; avoid it for sequential migrations or conflicting edits.                        |
| Instructions              | CLI reads repo instructions from `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`, `AGENTS.md`, and related files.                                                                                                                       | Keep repo-wide and path-specific instructions as the primary convention source. Do not duplicate all rules in every agent.                                      |
| Skills                    | CLI supports `/skills` and skill-managed capabilities.                                                                                                                                                                                                                 | Keep existing skills and reference them in agent instructions; verify they load via `/env` and `/skills list`.                                                  |
| Hooks                     | Copilot CLI hooks use `.github/hooks/*.json` with `version: 1` and lower-camel event names such as `sessionStart`, `sessionEnd`, `preToolUse`, and `postToolUse`. Only `preToolUse` can deny tool execution. Session hook output is ignored by the official reference. | Do not rely on hooks to inject context. Use hooks narrowly for policy/safety in autopilot, especially dangerous-command denial.                                 |
| Anvil custom agent        | Anvil is an evidence-first agent with task/risk sizing, git hygiene, session-history recall, baseline capture, SQL-tracked verification, adversarial review, operational-readiness checks, evidence bundles, and rollback guidance.                                    | A separate EventKart agent will not automatically inherit Anvil behavior; port the high-value practices explicitly and adapt user-approval gates for autopilot. |
| Existing plan mismatch    | The previous draft was VS Code Chat Customizations-oriented and relied on `.prompt.md` files, VS Code tool IDs, Chat Diagnostics, and declarative handoffs.                                                                                                            | Reframe around Copilot CLI, `.agent.md`, `/env`, `/agent`, `/fleet`, autopilot flags, and CLI hook schema.                                                      |

Official docs used:

- GitHub Copilot CLI usage and command reference
- Copilot CLI autopilot documentation
- Copilot CLI `/fleet` documentation
- Copilot CLI custom agents documentation
- Custom agents configuration reference
- Copilot CLI hooks documentation and hook configuration reference
- Copilot CLI best practices

---

## Current State

| Type          | Location                                                   | Current state                                                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt files  | `.github/prompts/`                                         | 5 VS Code-style prompt files exist. They are useful source material but should not be the CLI automation surface; retain them temporarily until one successful dry run and one successful real feature run verify the new CLI workflow. |
| Instructions  | `.github/copilot-instructions.md`, `.github/instructions/` | Repo-wide and path-specific instructions already exist and should remain authoritative.                                                                                                                                                 |
| Skills        | `.agents/skills/` and user/global skills                   | Project skills exist for Drizzle, Fastify, OWASP, Redis, Tailwind/shadcn, TanStack, and Zod.                                                                                                                                            |
| Custom agents | `.github/agents/`                                          | Shared conventions plus workflow, planner, plan reviewer, implementer, and code-reviewer profiles exist; static frontmatter/tool validation passed.                                                                                     |
| Hooks         | `.github/hooks/`                                           | Hook configs use CLI schema with `version: 1` and lower-camel events; the dangerous-command guard exists and passed syntax/smoke validation.                                                                                            |

---

## Target Architecture

### Agent Flow

```text
User prompt in Copilot CLI autopilot mode
  |
  v
eventkart-workflow
  |-- validates scope from feature ID, module name, or ad hoc request
  |-- creates/updates implementation plan under docs/impl-plan/
  |-- invokes planner/reviewer/implementer/reviewer phases through agent delegation
  |-- uses /fleet where subtasks are independent
  |-- records decisions and phase status in the plan run ledger
  |
  +--> eventkart-planner
  |       creates the implementation plan
  |
  +--> eventkart-plan-reviewer
  |       reviews and revises the plan without waiting for user approval
  |
  +--> eventkart-implementer
  |       implements vertical slices and updates progress docs
  |
  +--> eventkart-code-reviewer
          reviews changes, returns blocking findings, loops back to implementer
```

### Why one primary workflow agent?

Copilot CLI does not provide reliable declarative `send: true` handoffs in `.agent.md` files. A single `eventkart-workflow` agent is therefore the stable entrypoint. Specialist agents still exist, but the workflow agent owns orchestration and persistence.

### Anvil Compatibility Boundary

If you switch from `anvil` to `eventkart-workflow`, Copilot CLI will use the selected agent's prompt and tools. The new EventKart agent does **not** automatically inherit Anvil's evidence-first loop, SQL verification ledger, adversarial review, or rollback behavior.

To avoid losing the useful parts of Anvil, this plan ports the practices that matter for EventKart feature work:

1. Task size and risk classification before editing.
2. Git hygiene and user-work protection.
3. Session-history recall before planning.
4. Reuse survey before new abstractions.
5. Baseline capture before code changes.
6. Layered verification after changes.
7. Verification ledger and evidence bundle.
8. Adversarial review and fix loops.
9. Operational-readiness checks for high-risk changes.
10. Rollback guidance in final output.

This plan intentionally does **not** port Anvil's approval-oriented `ask_user` gates as-is. In EventKart autopilot mode, those gates become documented decisions, safe defaults, or hard blockers only when continuing would risk data loss, irreversible external effects, or user work.

### Autopilot Contract

When launched with `--mode autopilot --allow-all --no-ask-user`, the workflow must:

1. Not ask the user to approve the plan.
2. Not ask the user to choose between implementation options.
3. Not ask the user before fixing review findings.
4. Not ask the user before running validation commands.
5. Not ask the user before updating `progress.md`, `docs/v1-implementation-plan.md`, or the active `docs/impl-plan/*.md` when implementing planned features.
6. Continue until complete, blocked, or the max continuation/review-loop limit is reached.

The workflow may stop only when:

1. A required secret/credential or external service is unavailable.
2. The requested task requires an irreversible external side effect that was not explicitly requested, such as production deploy, real payment capture/refund, destructive data deletion, or force push.
3. A safety hook denies an operation.
4. The repository is in a conflicting state that cannot be resolved without risking user work.
5. The max autopilot continuation or review-loop cap is reached.

### Autopilot Decision Policy

Replace the old "No Assumptions Policy" with this autopilot-safe policy:

| Decision type                         | Agent behavior                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing project convention covers it | Follow the convention and continue.                                                                                                                                                                                   |
| Multiple reversible options exist     | Choose the smallest production-ready option that preserves package boundaries and testability; log the choice in the plan ledger.                                                                                     |
| Missing prerequisite feature          | Include prerequisite work if it is required for the requested feature and can be completed in the same vertical slice; otherwise create a narrow stub only when the docs already define the contract. Log the choice. |
| Scope is large                        | Split into sequential vertical slices and use `/fleet` only for independent research/test/review subtasks. Do not ask the user to split.                                                                              |
| Business behavior is ambiguous        | Implement the conservative behavior that minimizes data exposure, financial risk, and user-visible surprise. Add an assumption and follow-up note.                                                                    |
| New dependency is tempting            | Avoid adding it if an existing package or simple local helper is sufficient. If unavoidable, install with `pnpm` and document why.                                                                                    |
| Validation failure has multiple fixes | Prefer the fix that preserves existing behavior and narrows the change. Document the reason.                                                                                                                          |
| Security/privacy risk is unclear      | Choose the stricter security/privacy option and continue if reversible. Stop only if no safe implementation exists.                                                                                                   |
| Anvil-style pushback is triggered     | In autopilot, do not ask for confirmation. If the concern is reversible, choose the safer/smaller implementation and log the pushback. If the concern is irreversible or unsafe, stop as blocked.                     |

Every non-obvious choice must be recorded in the implementation plan under `## Agent Run Ledger`.

### Anvil-Derived Quality Gates

Every EventKart feature workflow should use these gates unless the task is explicitly documentation-only.

#### Task sizing

| Size   | Examples                                                                                  | Required gates                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Small  | typo, doc tweak, one-file config tweak                                                    | Quick diagnostics/format check only; no adversarial review required.                                            |
| Medium | bug fix, single feature slice, moderate refactor                                          | Baseline capture, verification ledger, at least one adversarial review, evidence bundle.                        |
| Large  | multi-workspace feature, auth, payments, privacy-sensitive data, schema migration, queue  | Baseline capture, verification ledger, multiple specialist reviews or `/fleet` review passes, readiness checks. |
| Red    | auth, crypto, payments, data deletion, schema migrations, concurrency, public API surface | Treat as Large even if the code diff is small.                                                                  |

#### Git hygiene

Before editing Medium/Large work:

1. Check `git status --short`.
2. Check the current branch.
3. Identify whether existing changes are unrelated.
4. In autopilot:
   - continue if the worktree only contains the active workflow changes;
   - avoid touching unrelated dirty files;
   - stop as blocked if unrelated dirty files overlap the requested scope and proceeding would risk overwriting user work;
   - create a feature branch only when the prompt or repo workflow explicitly asks for branch creation.

#### Session-history recall

Before planning Medium/Large work, query prior session history when available:

1. Search previous sessions touching the same files/modules.
2. Search for prior regressions, reverted changes, failed validations, or known fragile areas.
3. Record relevant history in the plan under `## Autopilot Assumptions` or `## Agent Run Ledger`.

#### Verification ledger

The workflow must record verification as evidence, not prose.

Preferred storage:

1. Use a session SQL table when a writable SQL/session database is available.
2. Otherwise, mirror the same rows in the active implementation plan under `## Verification Ledger`.

Minimum schema:

```sql
CREATE TABLE IF NOT EXISTS eventkart_agent_checks (
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

Rule: if the check is not in the ledger, the final response must not claim it happened.

#### Baseline capture

Before changing code for Medium/Large work:

1. Capture diagnostics for files expected to change when IDE/LSP diagnostics are available.
2. Run the smallest relevant existing validation command that establishes current state.
3. Record pre-existing failures separately from failures introduced by the workflow.

#### Verification cascade

After implementation:

1. Diagnostics for changed files and importers when available.
2. Syntax/parse/type checks appropriate to affected workspaces.
3. Lint for affected workspaces or changed files.
4. Relevant tests.
5. If no runtime signal exists, run a lightweight import/load/smoke check or record why it is infeasible.

Minimum signals:

- Medium: at least 2 after-change verification rows.
- Large/Red: at least 3 after-change verification rows plus review rows.

#### Adversarial review

Before final output for Medium/Large work:

1. Stage or otherwise capture the diff for review.
2. Run at least one independent review for Medium work.
3. Run multiple independent review passes for Large/Red work. Prefer `/fleet` or specialist review agents for independent security, migration, and frontend/accessibility checks.
4. Fix real findings and rerun the relevant verification cascade.
5. Stop after 2 adversarial rounds if unresolved findings remain; report them as blockers or known risks with low confidence.

#### Operational readiness

For Large/Red work, verify:

1. Errors are surfaced or logged with useful context.
2. External dependency failures degrade safely.
3. Secrets/configuration are not hardcoded.
4. Sensitive data is not logged.
5. Rollback path is documented.

#### Evidence bundle

Final output for Medium/Large work should include:

1. Task ID, task size, and risk level.
2. What changed.
3. Baseline result summary.
4. After-change verification summary.
5. Review findings and fixes.
6. Remaining uncertainty, if any.
7. Rollback guidance.

---

## Files to Create or Update

| File                                                 | Action                                   | Purpose                                                                                                                            |
| ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `.github/agents/eventkart-workflow.agent.md`         | Create                                   | Primary CLI entrypoint and orchestration agent.                                                                                    |
| `.github/agents/eventkart-planner.agent.md`          | Create                                   | Specialist for plan creation and prerequisite analysis.                                                                            |
| `.github/agents/eventkart-plan-reviewer.agent.md`    | Create                                   | Specialist for reviewing and revising implementation plans.                                                                        |
| `.github/agents/eventkart-implementer.agent.md`      | Create                                   | Specialist for implementation, validation, and progress docs.                                                                      |
| `.github/agents/eventkart-code-reviewer.agent.md`    | Create                                   | Specialist for production-readiness code review.                                                                                   |
| `.github/agents/_eventkart-agent-conventions.md`     | Create                                   | Shared reference imported by all agent prompts via Markdown links.                                                                 |
| `.github/hooks/safety-policy.json`                   | Create                                   | Copilot CLI-compatible hook config for dangerous-command denial.                                                                   |
| `.github/hooks/scripts/guard-dangerous-commands.mjs` | Create                                   | `preToolUse` guard for autopilot safety.                                                                                           |
| `.github/hooks/progress-tracking.json`               | Update or retire                         | Do not rely on `sessionStart` output for context injection. If retained, convert to CLI schema and make it audit/check only.       |
| `.github/hooks/archive-impl-plans.json`              | Update or retire                         | Do not rely on `Stop` output for reminders. If retained, convert to `sessionEnd` and make it audit/check only.                     |
| `.github/prompts/*.prompt.md`                        | Retain temporarily; delete/archive later | Do not delete or modify prompt files until one successful CLI dry run and one successful real feature run verify the new workflow. |
| `.github/copilot-instructions.md`                    | Update only if needed                    | Add a short pointer to the new `eventkart-workflow` agent; avoid duplicating full agent instructions.                              |

---

## Phase 1 — Create Shared Agent Conventions

### Step 1: Create `.github/agents/_eventkart-agent-conventions.md`

This is not a custom agent. It is a shared Markdown reference linked from each agent profile.

Move and update the useful content from `.github/prompts/_shared-conventions.md`:

- Stack reference table
- Non-negotiable repo rules
- Package boundaries
- Workspace commands
- Reference docs table
- Skill mapping
- Security/privacy expectations
- Progress tracking requirements
- Branching and commit conventions

Changes to make during migration:

1. Replace "Decision Gates — No Assumptions Policy" with the **Autopilot Decision Policy** from this plan.
2. Add a **Copilot CLI Runtime** section:
   - Use `copilot --agent=eventkart-workflow --mode autopilot --allow-all --no-ask-user`.
   - Use `/fleet` only for independent subtasks.
   - Use `/env` to verify loaded agents, hooks, skills, MCP servers, and instructions.
   - Use `/tasks` to inspect subagent/background task state.
3. Add the **Anvil-Derived Quality Gates** from this plan.
4. Add an **Agent Run Ledger** template:

```markdown
## Agent Run Ledger

| Phase          | Agent                   | Status  | Size/Risk | Decisions / assumptions | Evidence |
| -------------- | ----------------------- | ------- | --------- | ----------------------- | -------- |
| Intake         | eventkart-workflow      | Pending |           |                         |          |
| Git hygiene    | eventkart-workflow      | Pending |           |                         |          |
| Baseline       | eventkart-workflow      | Pending |           |                         |          |
| Plan           | eventkart-planner       | Pending |           |                         |          |
| Plan review    | eventkart-plan-reviewer | Pending |           |                         |          |
| Implementation | eventkart-implementer   | Pending |           |                         |          |
| Verification   | eventkart-implementer   | Pending |           |                         |          |
| Code review    | eventkart-code-reviewer | Pending |           |                         |          |
| Fix loop       | eventkart-implementer   | Pending |           |                         |          |
| Final evidence | eventkart-workflow      | Pending |           |                         |          |
```

---

## Phase 2 — Create CLI-Compatible Custom Agents

Use CLI/custom-agent aliases, not VS Code internal tool IDs.

Do not use these in agent frontmatter:

- `search/codebase`
- `searchResults`
- `execute/createAndRunTask`
- `read/problems`
- `vscode/vscodeAPI`
- `handoffs`
- `argument-hint`

Use these aliases instead:

- `read`
- `search`
- `edit`
- `execute`
- `agent`
- `web`

### Step 2: Primary workflow agent

**File:** `.github/agents/eventkart-workflow.agent.md`

Recommended frontmatter:

```yaml
---
name: eventkart-workflow
description: End-to-end EventKart feature workflow for Copilot CLI autopilot and fleet mode. Plans, reviews, implements, validates, reviews again, fixes findings, and updates progress docs without waiting for user approval.
target: github-copilot
tools: ["read", "search", "edit", "execute", "agent", "web"]
user-invocable: true
disable-model-invocation: false
---
```

Responsibilities:

1. Accept any of:
   - v1 feature ID, such as `I-1.2.3`
   - module name from `docs/v1-implementation-plan.md`
   - ad hoc feature request not yet in the implementation plan
2. Read:
   - `.github/agents/_eventkart-agent-conventions.md`
   - `.github/copilot-instructions.md`
   - applicable `.github/instructions/**/*.instructions.md`
   - `docs/v1-implementation-plan.md`
   - `docs/requirements.md`
   - `docs/architecture.md`
3. Resolve scope:
   - For feature IDs, locate feature rows and prerequisites.
   - For ad hoc requests, map to nearest requirement/module when possible and mark as `ad-hoc` if no matching feature ID exists.
4. Create or update `docs/impl-plan/feature-<scope>.md`.
5. Add the Agent Run Ledger to the plan.
6. Classify task size and risk using the Anvil-derived quality gates.
7. Run git hygiene before editing and protect unrelated user changes.
8. Capture baseline state before implementation for Medium/Large work.
9. Maintain the Verification Ledger in SQL when available, otherwise in the plan.
10. Delegate phase work to specialist agents where useful.
11. Use `/fleet` for independent subtasks only.
12. Enforce max loops:
    - Plan review loops: 2
    - Code review/fix loops: 3
    - Adversarial review rounds: 2
13. Produce the final Evidence Bundle.
14. Stop only under the Autopilot Contract blockers.

### Step 3: Planner agent

**File:** `.github/agents/eventkart-planner.agent.md`

Recommended frontmatter:

```yaml
---
name: eventkart-planner
description: Creates EventKart implementation plans from feature IDs, modules, or ad hoc feature requests.
target: github-copilot
tools: ["read", "search", "edit", "web"]
user-invocable: true
disable-model-invocation: false
---
```

Responsibilities:

1. Build a complete implementation plan under `docs/impl-plan/`.
2. Include requirements, acceptance criteria, prerequisites, schema/API/UI design, testing plan, rollout notes, and validation commands.
3. Add or update the Agent Run Ledger.
4. Add task size, risk classification, blast-radius notes, and rollback considerations.
5. Include a baseline and verification strategy, not just implementation steps.
6. Include likely adversarial review passes for Medium/Large/Red work.
7. Document assumptions instead of asking questions.
8. If Context7 or another docs MCP server is available, use it for current library docs; otherwise use official web docs.
9. Use `edit` only for the implementation plan file, not product code.

Plan file minimum sections:

```markdown
# Implementation Plan: <scope>

## Scope

## Source Features / Requirements

## Autopilot Assumptions

## Prerequisites and Dependency Chain

## Architecture Notes

## Database Plan

## API Plan

## Frontend Plan

## Testing Plan

## Validation Plan

## Progress Tracking Updates

## Agent Run Ledger

## Verification Ledger

## Task Table

## Files Summary

## Rollback Plan

## Risks and Follow-ups
```

### Step 4: Plan reviewer agent

**File:** `.github/agents/eventkart-plan-reviewer.agent.md`

Recommended frontmatter:

```yaml
---
name: eventkart-plan-reviewer
description: Reviews EventKart implementation plans for completeness, safety, architecture fit, testability, and autopilot readiness.
target: github-copilot
tools: ["read", "search", "edit", "web"]
user-invocable: true
disable-model-invocation: false
---
```

Responsibilities:

1. Review the plan for:
   - Requirements coverage
   - Prerequisite chain correctness
   - Existing-code reuse
   - Package boundary compliance
   - Security and privacy
   - Migration safety
   - Performance and accessibility
   - Test coverage
   - Autopilot ambiguity risk
   - Task size/risk classification
   - Baseline and verification strategy
   - Adversarial review strategy
   - Rollback plan
2. If revisions are needed, update the plan directly instead of asking the user.
3. Add a plan-review row to the Agent Run Ledger.
4. Return `Approved for implementation` only when the plan is actionable without additional user decisions.

### Step 5: Implementer agent

**File:** `.github/agents/eventkart-implementer.agent.md`

Recommended frontmatter:

```yaml
---
name: eventkart-implementer
description: Implements approved EventKart plans as vertical slices, validates changes, and updates progress documentation.
target: github-copilot
tools: ["read", "search", "edit", "execute", "agent", "web"]
user-invocable: true
disable-model-invocation: false
---
```

Implementation order:

1. Shared schemas/types (`packages/shared`)
2. Database schemas/migrations (`packages/db`)
3. Backend modules/routes/tests (`apps/api`)
4. Frontend routes/features/components/tests (`apps/web`)
5. Progress docs:
   - `progress.md`
   - `docs/v1-implementation-plan.md`
   - active `docs/impl-plan/*.md`

Rules:

1. Follow the approved plan unless code reality proves it wrong.
2. If the plan is wrong, make the smallest safe correction and record it in the Agent Run Ledger.
3. Use `pnpm` only.
4. Never introduce ESLint, Prettier for code, Jest, or Tailwind config files.
5. Never import directly between `apps/web` and `apps/api`.
6. Run relevant `check-types`, `lint`, and `test` commands for affected workspaces.
7. If validation fails, fix and rerun until clean or blocked by a known baseline issue. If a baseline issue blocks validation, document the exact unrelated failure and show that the changed scope is isolated.
8. Insert or append every verification result to the Verification Ledger before claiming it passed.
9. Do not present code as complete until the minimum verification signals for its size/risk are recorded.
10. Record rollback guidance for every file group changed.

### Step 6: Code reviewer agent

**File:** `.github/agents/eventkart-code-reviewer.agent.md`

Recommended frontmatter:

```yaml
---
name: eventkart-code-reviewer
description: Reviews EventKart implementation changes for production readiness with focus on real correctness, security, privacy, performance, migration safety, and tests.
target: github-copilot
tools: ["read", "search", "execute", "agent", "web"]
user-invocable: true
disable-model-invocation: false
---
```

Review dimensions:

1. Correctness and completeness against the plan
2. Package boundaries and reuse
3. TypeScript strictness
4. Fastify/TanStack/Drizzle/Zod conventions
5. OWASP security concerns
6. Privacy and DPDPA-sensitive data handling
7. Migration safety and rollback readiness
8. Performance and query/index behavior
9. Accessibility and web standards
10. Tests and validation quality
11. Regression risk compared with baseline ledger entries
12. Rollback safety

Output format:

```markdown
## Review Summary

**Scope:** <feature/change scope>
**Verdict:** Ready / Needs changes / Blocked

### Blocking Findings

| File | Issue | Required fix |
| ---- | ----- | ------------ |

### Improvements Applied or Recommended

| File | Issue | Action |
| ---- | ----- | ------ |

### Validation Evidence

| Command | Result |
| ------- | ------ |

### Evidence Bundle Check

| Required evidence | Present? | Notes |
| ----------------- | -------- | ----- |

### Final Notes
```

If blocking findings exist, the workflow agent sends them to `eventkart-implementer` for another fix loop. The reviewer does not edit product code directly.

For Medium work, run at least one independent review. For Large/Red work, run multiple independent review passes where possible and record every verdict in the Verification Ledger before final reporting.

---

## Phase 3 — Configure Hooks for Autopilot Safety

Hooks should not be used as the main context/instruction mechanism. Use instructions and agents for context. Use hooks for deterministic policy.

### Step 7: Create dangerous-command guard

**File:** `.github/hooks/safety-policy.json`

Use official Copilot CLI hook shape:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "node .github/hooks/scripts/guard-dangerous-commands.mjs",
        "powershell": "node .github/hooks/scripts/guard-dangerous-commands.mjs",
        "timeoutSec": 10
      }
    ]
  }
}
```

**File:** `.github/hooks/scripts/guard-dangerous-commands.mjs`

Guard behavior:

1. Parse hook input from stdin.
2. Inspect `toolName` and `toolArgs`.
3. Deny destructive operations that should never happen silently in autopilot:
   - `git reset --hard`
   - force push
   - deleting `.env*`
   - deleting `packages/db/drizzle` migration history
   - `rm -rf /`, `Remove-Item -Recurse -Force` on repo root, or equivalent destructive broad deletes
   - direct production deploy commands unless the initial prompt explicitly requested deploy
   - real payment capture/refund commands
   - use of `npm` or `yarn` in this pnpm repo
4. Output:

```json
{
  "permissionDecision": "deny",
  "permissionDecisionReason": "<specific policy reason>"
}
```

Only use deny for high-confidence unsafe actions. Do not turn the hook into an approval system.

### Step 8: Reconcile existing hooks

Existing files:

- `.github/hooks/progress-tracking.json`
- `.github/hooks/archive-impl-plans.json`

Required change:

1. Add `"version": 1`.
2. Rename events to official lower-camel names:
   - `SessionStart` -> `sessionStart`
   - `Stop` -> `sessionEnd`
3. Replace `command`/`timeout` fields with `bash`/`powershell` and `timeoutSec`.
4. Do not depend on hook stdout to inject `systemMessage`; official CLI docs say session hook output is ignored.
5. Keep progress rules in `.github/instructions/progress-tracking.instructions.md` and agent conventions instead.
6. If these hooks are retained, make them audit/check hooks only. If they add no value after instruction migration, delete them.

---

## Phase 4 — Deprecate Prompt Files

The `.github/prompts/*.prompt.md` files are VS Code prompt-command assets. They should not drive the Copilot CLI autopilot workflow.

### Step 9: Migration approach

1. Migrate reusable content from prompt files into:
   - `.github/agents/_eventkart-agent-conventions.md`
   - the five custom agent profiles
   - existing `.github/instructions/*.instructions.md`
2. Keep prompt files temporarily while validating the new CLI workflow.
3. Current decision: do **not** delete or modify `.github/prompts/*.prompt.md` yet. Deletion/archive is deferred until the CLI verification checklist records one successful dry run and the real workflow checklist records one successful feature run.
4. After one successful dry run and one successful real feature run, either:
   - delete the prompt files, or
   - move them to a clearly deprecated archive if the team still uses VS Code prompt commands.

Files to deprecate:

| File                                                   | Replacement                                       |
| ------------------------------------------------------ | ------------------------------------------------- |
| `.github/prompts/eventkart-feature-workflow.prompt.md` | `.github/agents/eventkart-workflow.agent.md`      |
| `.github/prompts/eventkart-plan.prompt.md`             | `.github/agents/eventkart-planner.agent.md`       |
| `.github/prompts/eventkart-implement.prompt.md`        | `.github/agents/eventkart-implementer.agent.md`   |
| `.github/prompts/eventkart-review.prompt.md`           | `.github/agents/eventkart-code-reviewer.agent.md` |
| `.github/prompts/_shared-conventions.md`               | `.github/agents/_eventkart-agent-conventions.md`  |

---

## Phase 5 — Runtime Usage Patterns

### Standard feature implementation

```sh
copilot --experimental --agent=eventkart-workflow --mode autopilot --allow-all --no-ask-user --max-autopilot-continues 250 -p "/fleet Implement I-1.2.3 end-to-end for EventKart. Create the plan, review it, implement it, review code, fix findings, update progress docs, and stop when complete."
```

### Ad hoc feature implementation

```sh
copilot --experimental --agent=eventkart-workflow --mode autopilot --allow-all --no-ask-user --max-autopilot-continues 250 -p "/fleet Implement an ad hoc organizer dashboard export feature. Map it to existing requirements if possible; otherwise mark it as ad-hoc. Plan, review, implement, validate, review, fix, and update progress docs."
```

### Planning-only run

Use this when a human wants the plan but no code:

```sh
copilot --agent=eventkart-planner --prompt "Create an implementation plan for I-1.2.3. Write the plan under docs/impl-plan/. Do not implement product code."
```

### Review-only run

```sh
copilot --agent=eventkart-code-reviewer --prompt "Review the current branch against the active implementation plan. Focus only on real production-impacting issues."
```

### When to use `/fleet`

Use `/fleet` for:

1. Parallel codebase research across API, web, shared, and DB.
2. Independent test creation after implementation boundaries are known.
3. Independent review passes, such as security, migration safety, and frontend accessibility.

Avoid `/fleet` for:

1. Database migration generation and application.
2. Multiple agents editing the same files.
3. Sequential refactors where later steps depend on earlier edits.
4. Any task where merge conflicts are likely.

---

## Phase 6 — Verification Checklist

### Static verification

1. [x] `.github/agents/*.agent.md` files parse as valid YAML frontmatter.
2. [x] Agent names are unique and filename-safe.
3. [x] Agent `tools` use only CLI-compatible aliases or valid MCP tool names.
4. [x] No agent depends on unsupported `handoffs` or VS Code-only tool IDs.
5. [x] Hook JSON files include `"version": 1`.
6. [x] Hook event names are lower camel case.
7. [x] Safety hook script reads stdin JSON and outputs compact JSON only when denying.

### CLI verification

1. [ ] Start Copilot CLI from repo root.
2. [ ] Run `/env` and verify instructions, agents, skills, hooks, and MCP servers load.
3. [ ] Run `/agent` and verify all EventKart agents appear.
4. [ ] Run `/skills list` and verify expected skills are available.
5. [ ] Run a dry-run prompt:

```sh
copilot --experimental --agent=eventkart-workflow --mode autopilot --allow-all --no-ask-user --max-autopilot-continues 3 -p "Dry run only. Inspect EventKart workflow setup, identify the next implementation phase for I-0.1.1, create no product code changes, and report whether the workflow can plan/review/implement/review autonomously."
```

6. [ ] Confirm the dry run does not ask for user input.
7. [ ] Confirm `/fleet` can spawn subagents for independent research when requested.
8. [ ] Confirm the safety hook denies a known unsafe command in a controlled test.

### Real workflow verification

1. [ ] Run the workflow on a small feature or intentionally tiny ad hoc doc-only task.
2. [ ] Confirm it creates a plan under `docs/impl-plan/`.
3. [ ] Confirm plan review happens without human approval.
4. [ ] Confirm implementation proceeds without human approval.
5. [ ] Confirm code review loops back to implementation when findings exist.
6. [ ] Confirm validation commands run.
7. [ ] Confirm progress docs are updated when implementation work is from `docs/impl-plan/` or `docs/v1-implementation-plan.md`.
8. [ ] Confirm final output states complete or blocked with exact evidence.

---

## Implementation Task Table

| Task ID  | Description                                                                                                                                                             | Completed  | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| TASK-001 | Create `.github/agents/_eventkart-agent-conventions.md` from shared prompt conventions and autopilot policy.                                                            | ✅         | 2026-04-27 |
| TASK-002 | Create `eventkart-workflow.agent.md` as the primary CLI/autopilot entrypoint.                                                                                           | ✅         | 2026-04-27 |
| TASK-003 | Create `eventkart-planner.agent.md`.                                                                                                                                    | ✅         | 2026-04-27 |
| TASK-004 | Create `eventkart-plan-reviewer.agent.md`.                                                                                                                              | ✅         | 2026-04-27 |
| TASK-005 | Create `eventkart-implementer.agent.md`.                                                                                                                                | ✅         | 2026-04-27 |
| TASK-006 | Create `eventkart-code-reviewer.agent.md`.                                                                                                                              | ✅         | 2026-04-27 |
| TASK-007 | Create Copilot CLI safety hook config and dangerous-command guard script.                                                                                               | ✅         | 2026-04-27 |
| TASK-008 | Reconcile or retire existing progress/archive hooks for official CLI hook schema.                                                                                       | ✅         | 2026-04-27 |
| TASK-009 | Add a short pointer in `.github/copilot-instructions.md` to the new workflow agent if useful.                                                                           | ✅         | 2026-04-27 |
| TASK-010 | Validate static agent/hook setup, guard smoke tests, Markdown formatting, and Biome checks.                                                                             | ✅         | 2026-04-27 |
| TASK-011 | Decide prompt file deprecation: retain `.github/prompts/*.prompt.md` temporarily and defer deletion/archive until successful dry-run and real feature-run verification. | ⏸ Deferred | 2026-04-27 |

---

## Decisions Log

| Decision          | Choice                                                                   | Rationale                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary interface | `eventkart-workflow` custom agent                                        | Copilot CLI supports selecting agents with `/agent` or `--agent`; one entrypoint gives seamless handoff.                                                                                                                    |
| Handoff mechanism | Agent instructions + `agent` tool + `/fleet`, not declarative `handoffs` | GitHub custom-agent docs say VS Code `handoffs` are ignored for GitHub Copilot compatibility.                                                                                                                               |
| Approval behavior | No approval waits in autopilot                                           | User explicitly requires seamless handoff without waiting for approval.                                                                                                                                                     |
| Decision policy   | Autopilot-safe defaults with logged assumptions                          | Avoids blocking while preserving traceability.                                                                                                                                                                              |
| Tool names        | CLI aliases (`read`, `search`, `edit`, `execute`, `agent`, `web`)        | These are documented for GitHub custom agents and portable across CLI/cloud.                                                                                                                                                |
| Model pinning     | Do not hardcode unverified model labels initially                        | Available model identifiers vary by account/version; use `/model` or `--model` at runtime until stable IDs are verified.                                                                                                    |
| Fleet usage       | Use for independent subtasks only                                        | Prevents conflicting edits and migration races.                                                                                                                                                                             |
| Hooks             | Safety/policy only                                                       | Official CLI hook docs do not support session hook context injection; `preToolUse` can deny unsafe actions.                                                                                                                 |
| Prompt files      | Retain temporarily; delete/archive only after verification               | Do not delete or modify `.github/prompts/*.prompt.md` until one successful dry run and one successful real feature run verify the CLI workflow; this avoids disrupting VS Code users while runtime verification is pending. |

---

## Explicitly Out of Scope

| Item                                  | Reason                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Creating utility prompts              | Prompt files are not the CLI workflow surface.                           |
| Adding a Biome formatting hook        | Previously excluded and not required for autopilot handoff.              |
| Production deployment automation      | Requires explicit user request and environment-specific safety controls. |
| Real payment operations               | Must not run silently in autopilot.                                      |
| Force push or destructive Git cleanup | Must be denied by safety hook.                                           |
