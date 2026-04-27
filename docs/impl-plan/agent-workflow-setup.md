# Plan: Agent-First EventKart Development Workflow

> **Status:** In progress — runtime warnings fixed; prompt deletion remains deferred until CLI verification
> **Date:** 2026-04-27
> **Scope:** Replace prompt-based feature workflow with custom-agent workflow

---

## TL;DR

Replace the current `.prompt.md`-based feature workflow with a **custom-agent workflow** using Copilot CLI-compatible `.agent.md` files. One lightweight workflow agent coordinates four specialized subagents — it does not plan, implement, or review itself. Prompt deletion stays deferred until the CLI agent workflow is verified.

### Agent Flow

```
User (feature IDs)
  │
  ▼
┌─────────────────────────────┐
│  eventkart-workflow         │  ← coordination only, no planning/implementation/review
│  (default model)            │
└──────────┬──────────────────┘
           │ invokes
           ▼
┌─────────────────────────────┐
│  eventkart-planner          │  ← Claude Opus 4.6 (copilot)
│  read-only + research tools │
└──────────┬──────────────────┘
           │ auto-handoff (send: true)
           ▼
┌─────────────────────────────┐
│  eventkart-plan-reviewer    │  ← GPT 5.5 High (copilot)
│  read-only tools            │
└──────────┬──────────────────┘
           │ auto-handoff (send: true)
           ▼
┌─────────────────────────────┐
│  eventkart-implementer      │  ← GPT 5.5 High (copilot)
│  full edit + terminal tools │
└──────────┬──────────────────┘
           │ auto-handoff (send: true)
           ▼
┌─────────────────────────────┐
│  eventkart-code-reviewer    │  ← GPT 5.5 X High (copilot)
│  read + terminal + edit     │
└──────────┬──────────────────┘
           │ handoff back if fixes needed
           ▼
     eventkart-implementer (loop)
```

---

## Current State

### What Exists

| Type | Location | Count | Files |
|------|----------|-------|-------|
| Prompt files | `.github/prompts/` | 5 | `_shared-conventions.md`, `eventkart-feature-workflow.prompt.md`, `eventkart-plan.prompt.md`, `eventkart-implement.prompt.md`, `eventkart-review.prompt.md` |
| Instruction files | `.github/instructions/` | 3 | `fastify-backend.instructions.md`, `tanstack-start.instructions.md`, `progress-tracking.instructions.md` |
| Skills | `.agents/skills/` | 9 | drizzle, fastify-best-practices, owasp-security, redis-development, tailwind-v4-shadcn, tanstack-form, tanstack-router-best-practices, tanstack-start-best-practices, zod |
| Copilot instructions | `.github/` | 1 | `copilot-instructions.md` |
| Custom agents | `.github/agents/` | 5 | `eventkart-workflow.agent.md`, `eventkart-planner.agent.md`, `eventkart-plan-reviewer.agent.md`, `eventkart-implementer.agent.md`, `eventkart-code-reviewer.agent.md` |
| Hooks | `.github/hooks/` | 3 | `safety-policy.json`, `progress-tracking.json`, `archive-impl-plans.json` |

### Problems with Current Setup

1. **Prompt files acting as agents** — `.prompt.md` files are designed for single-task slash commands, not persistent personas with tool restrictions and handoffs.
2. **No native handoffs** — The orchestrator prompt manually delegates by referencing other prompt files; VS Code supports one-click handoff buttons with context carried over.
3. **No plan review stage** — Planning goes straight to implementation with no independent review of the plan.
4. **No tool restrictions** — All prompts have the same full tool set; the planner should be read-only.
5. **No model pinning** — All prompts use whatever model is selected; different phases need different model strengths.

---

## Phase 1 — Create the Agent Workflow

### Step 1: Workflow Agent

**File:** `.github/agents/eventkart-workflow.agent.md`

| Field | Value |
|-------|-------|
| Purpose | Coordination only — parse user input, invoke subagents, monitor handoffs, preserve decisions |
| Model | Not pinned (coordination doesn't need reasoning-heavy model) |
| Tools | Minimal read-only: `search/codebase`, `search`, `searchResults`, `read/problems` |
| Subagents | `eventkart-planner`, `eventkart-plan-reviewer`, `eventkart-implementer`, `eventkart-code-reviewer` |
| Edit tools | **None** |

**Responsibilities:**
- Accept feature IDs or module name from user
- Read `docs/v1-implementation-plan.md` to locate the requested features
- Trace prerequisite chain and check implementation status
- Invoke `eventkart-planner` with the scoped feature context
- Track completion of each phase and ensure correct next agent is invoked
- Preserve user decisions, prerequisite choices, and plan file path across handoffs
- Enforce decision gates from shared conventions

**Handoffs:**
- → `eventkart-planner`: "Plan Features" (send: true)

**Complexity:** M

---

### Step 2: Planner Agent

**File:** `.github/agents/eventkart-planner.agent.md`

| Field | Value |
|-------|-------|
| Purpose | Produce a detailed implementation plan |
| Model | `claude-opus-4.6:defaultReasoningEffort=high` with fallback `claude-opus-4.7:defaultReasoningEffort=medium` |
| Tools | `search/codebase`, `search`, `searchResults`, `search/usages`, `web/fetch`, `web/githubRepo`, `openSimpleBrowser`, `read/problems`, `mcp_io_github_ups_resolve-library-id/*`, `mcp_io_github_ups_get-library-docs/*` |
| Edit tools | **None** — read-only agent |
| user-invocable | true |
| disable-model-invocation | false |

**Responsibilities:**
1. Read `docs/v1-implementation-plan.md` — locate exact features requested
2. Read `docs/requirements.md` — find matching F-IDs for product context
3. Read `docs/architecture.md` — understand system constraints
4. Read `.github/copilot-instructions.md` — repo-wide rules
5. Read `.github/instructions/fastify-backend.instructions.md` if backend work involved
6. Read `.github/instructions/tanstack-start.instructions.md` if frontend work involved
7. Load applicable skill files per the skill mapping table
8. Use Context7 MCP tools (if available) or web fetch for official library docs
9. Trace ALL prerequisite feature IDs and scan codebase for implementation status
10. Flag missing prerequisites — ask user: include, stub, or build first
11. If scope > 10 tasks, recommend splitting and ask user for chunk preference
12. Produce plan file at `docs/impl-plan/feature-<module>-<feature-ids>.md` with:
    - Requirements (acceptance criteria, security, privacy/DPDPA, performance targets, accessibility)
    - Implementation steps per phase (exact file paths, what each file does, key details, dependencies, complexity S/M/L)
    - Database schema (full Drizzle definitions, migration strategy)
    - API endpoints (method, path, auth, rate limit, Zod schemas, error responses)
    - Frontend routes & components (route path, SSR mode, layout, data loading, key components, form validation)
    - Testing plan (every test file, happy path + 2 error paths minimum per endpoint)
    - Files summary (every file to create/modify, grouped by workspace, marked `[new]`/`[modify]`)

**Handoffs:**
- → `eventkart-plan-reviewer`: "Review Plan" (send: true, prompt: "Review the implementation plan generated above for production readiness.")

**Complexity:** L

---

### Step 3: Plan Reviewer Agent

**File:** `.github/agents/eventkart-plan-reviewer.agent.md`

| Field | Value |
|-------|-------|
| Purpose | Review the planner output before implementation |
| Model | `gpt-5.5:defaultReasoningEffort=high` |
| Tools | `search/codebase`, `search`, `searchResults`, `search/usages`, `web/fetch`, `read/problems` |
| Edit tools | **None** initially |
| user-invocable | true |

**Review Dimensions:**
1. **Requirements coverage** — every feature ID mapped to verifiable acceptance criteria
2. **Prerequisite chain correctness** — no missing dependencies
3. **Existing-code reuse** — no duplicated schemas/components/utilities
4. **Package boundary compliance** — shared types in `packages/shared`, UI in `packages/ui`, no cross-app imports
5. **Implementation order feasibility** — vertical slice order makes sense
6. **Security** — OWASP-relevant items identified for every endpoint handling user input
7. **Privacy/DPDPA** — personal/sensitive data handling flagged where applicable
8. **Performance** — targets defined, pagination planned for large lists, expensive ops offloaded
9. **Accessibility** — WCAG 2.1 AA considerations for frontend routes
10. **Web standards** — semantic HTML, keyboard navigation, focus management planned
11. **Test coverage** — every new file has test coverage, meaningful error paths included
12. **Migration safety** — expand/contract for existing tables, rollback files, no `NOT NULL` without defaults
13. **Ambiguities or hidden assumptions** — anything the planner assumed without asking

**Output Format:**
```markdown
## Plan Review Summary

**Plan File:** [path]
**Verdict:** ✅ Approved / ⚠️ Needs Revisions / ❌ Major Rework

### Required Fixes (must address before implementation)
- [ ] Issue — section reference — what needs to change

### Suggestions (would improve the plan)
- [ ] Suggestion — section reference — why it matters

### What's Good
- Positive observations about the plan quality
```

**Completion behavior:**
- If approved → hand off to `eventkart-implementer` with plan file path
- If revisions needed → list exact fixes, then hand back to `eventkart-planner` or update inline after user approval

**Handoffs:**
- → `eventkart-implementer`: "Start Implementation" (send: true, prompt: "Implement the approved plan outlined above.")
- → `eventkart-planner`: "Revise Plan" (send: false, prompt: "Revise the plan based on the review findings above.")

**Complexity:** M

---

### Step 4: Implementer Agent

**File:** `.github/agents/eventkart-implementer.agent.md`

| Field | Value |
|-------|-------|
| Purpose | Implement only the approved final plan |
| Model | `gpt-5.5:defaultReasoningEffort=high` |
| Tools | Full set: `search/changes`, `search/codebase`, `edit/editFiles`, `vscode/extensions`, `web/fetch`, `web/githubRepo`, `openSimpleBrowser`, `read/problems`, `execute/createAndRunTask`, `search`, `searchResults`, `read/terminalLastCommand`, `read/terminalSelection`, `execute/testFailure`, `search/usages`, `vscode/vscodeAPI` |
| user-invocable | true |

**Implementation Order (strict vertical slices):**

1. **Shared Schemas & Types** (`packages/shared`)
   - Zod schemas for request/response validation
   - Shared enums, constants, type exports

2. **Database** (`packages/db`)
   - Drizzle table schemas with types, indexes, constraints
   - Generate migration: `pnpm --filter @repo/db exec drizzle-kit generate`
   - Apply migration: `pnpm --filter @repo/db exec drizzle-kit migrate`
   - Migration safety rules:
     - Never add `NOT NULL` without a default on existing tables
     - Never drop columns in same migration as replacements (expand/contract)
     - Never rename columns — add new, migrate data, drop old (separate migrations)

3. **Backend** (`apps/api`)
   - Zod schemas for request/response
   - Service functions with business logic
   - Routes with auth preHandlers (`requireAuth`, `requireRole`)
   - Rate limiting where specified
   - Register in module route plugin

4. **Frontend** (`apps/web`)
   - Correct SSR mode per `tanstack-start.instructions.md`
   - Route loaders with `queryOptions()`
   - TanStack Form + Zod for forms
   - shadcn/ui components from `packages/ui`
   - Loading, error, and empty states

5. **Tests**
   - API: `buildTestApp()` + `app.inject()`, happy path + auth failures + validation errors + not found
   - Web: colocated `*.test.tsx`, component rendering + interactions + error states

6. **Progress Docs**
   - Update `progress.md`
   - Update `docs/v1-implementation-plan.md` status table
   - Mark plan tasks complete with dates

**Validation (run after ALL code is written):**
```sh
pnpm --filter <workspace> check-types
pnpm --filter <workspace> lint
pnpm --filter <workspace> test
```

**Rules:**
- Never silently deviate from the approved plan
- If implementation uncovers a plan issue → stop and route back through decision gate
- If shared schema changes break other workspace tests → fix those tests too
- If migration generated but feature fails validation → delete migration, fix, regenerate

**Self-Review Checklist (before handoff):**
- [ ] All API endpoints have auth guards where required
- [ ] All user input validated server-side
- [ ] No raw SQL — all queries use Drizzle ORM
- [ ] Sensitive data NOT logged
- [ ] Rate limiting on public endpoints
- [ ] No `import.meta.env` — uses proper env layer
- [ ] No manual `useMemo`/`useCallback`
- [ ] No hardcoded API URLs
- [ ] TypeScript compiles with zero new errors
- [ ] Biome lint passes with zero new warnings
- [ ] All Zod schemas validate on client and server
- [ ] Tests cover happy path + at least 2 error paths per endpoint

**Handoffs:**
- → `eventkart-code-reviewer`: "Review Implementation" (send: true, prompt: "Review the implementation changes made above for production readiness.")
- → `eventkart-planner`: "Plan Needs Update" (send: false, prompt: "The implementation revealed issues with the plan. Please revise based on the findings above.")

**Complexity:** L

---

### Step 5: Code Reviewer Agent

**File:** `.github/agents/eventkart-code-reviewer.agent.md`

| Field | Value |
|-------|-------|
| Purpose | Review the complete implementation for production readiness |
| Model | `gpt-5.5:defaultReasoningEffort=xhigh` |
| Tools | `search/changes`, `search/codebase`, `search`, `searchResults`, `search/usages`, `read/problems`, `execute/createAndRunTask`, `read/terminalLastCommand`, `read/terminalSelection`, `execute/testFailure`, `web/fetch`, `edit/editFiles`, `vscode/vscodeAPI` |
| user-invocable | true |

**Review Dimensions:**

#### A. Correctness & Completeness
- Does implementation match the approved plan?
- All acceptance criteria met?
- Missing edge cases (empty states, concurrent access, partial failures)?
- Routes, modules, registrations wired correctly?

#### B. Coding Standards & Reusability
- Module/feature structure matches conventions
- Biome formatting (tabs, double quotes)
- No ESLint/Prettier/Jest introduced
- Env access through proper layers
- No direct imports between `apps/web` and `apps/api`
- Shared schemas/types in `packages/shared`, not duplicated
- UI components in `packages/ui`, not duplicated in apps

#### C. TypeScript Quality
- Strict mode compliance (no `any`, no `@ts-ignore`)
- Proper `verbatimModuleSyntax` (type-only imports)
- `noUncheckedIndexedAccess` handled
- Response types inferred from Zod schemas

#### D. Security (OWASP Top 10)
- **Injection:** All queries parameterized via Drizzle ORM? Any raw SQL?
- **Broken Auth:** Auth guards on every protected endpoint? Session validation?
- **Sensitive Data Exposure:** Sensitive fields suppressed at API layer? Secrets in logs?
- **Broken Access Control:** Server-side ownership checks? Cross-tenant leaks?
- **Security Misconfiguration:** CORS, CSP, rate limiting, CSRF in place?
- **XSS:** React escaping + CSP? Any `dangerouslySetInnerHTML`?
- **Webhooks/Payments:** Signatures verified, retries/idempotency handled?

#### E. Privacy & Compliance
- Consent captured before data collection when required?
- Sensitive fields stored and retained appropriately?
- Data minimization followed?
- DPDPA (India) compliance flagged

#### F. Performance
- Database queries using proper indexes?
- N+1 query pattern avoided?
- Large lists paginated server-side?
- Expensive operations offloaded to BullMQ?
- Unnecessary rerenders, duplicate fetches, stale cache patterns?

#### G. Accessibility & Web Standards
- Semantic HTML elements used correctly
- ARIA attributes where needed
- Keyboard navigation works for all interactive elements
- Focus management on route transitions and modals
- Color contrast meets WCAG 2.1 AA
- Responsive behavior across viewports
- SSR/hydration mismatch issues

#### H. Migration Safety
- `NOT NULL` without default on existing table?
- Column drops or renames? (expand/contract required)
- Index additions on large tables? (`CONCURRENTLY` if supported)
- Migration reversible?

#### I. Testing Quality
- New/changed behavior covered by tests?
- Happy path per endpoint/component?
- Meaningful error paths (auth failure, validation error, not found)?
- API tests use `buildTestApp()` + `app.inject()`?
- Tests clean up resources (`afterAll(() => app.close())`)?
- No flaky patterns (timeouts, race conditions, test interdependence)?

**Output Format:**
```markdown
## Review Summary

**Scope:** [feature name/IDs or changed files]
**Verdict:** ✅ Ready / ⚠️ Needs Changes / ❌ Blocking Issues

### Critical (must fix before merge)
- [ ] Issue — `file:line` — fix suggestion

### Improvements (should fix)
- [ ] Issue — `file:line` — why it matters

### Nits (nice to have)
- [ ] Issue — `file:line`

### What's Good
- Positive observations

### Automated Check Results
- check-types: ✅/❌
- lint: ✅/❌
- test: ✅/❌ (X passed, Y failed) / ⚠️ No tests found
```

**Completion behavior:**
- If fixes needed → hand off to implementer with exact findings
- If approved → present summary and ask about committing

**Handoffs:**
- → `eventkart-implementer`: "Fix Issues" (send: true, prompt: "Fix the critical and improvement issues identified in the review above.")

**Complexity:** L

---

## Phase 2 — Shared Agent Conventions File

### Step 6: Move `_shared-conventions.md` to a shared agent conventions file

**File:** `.github/agent-conventions.md`

This is NOT an agent — it's a shared reference file linked by all agents via Markdown links. Keep it outside `.github/agents/` so Copilot does not parse it as a custom agent profile.

**Content to migrate from** `.github/prompts/_shared-conventions.md`:
- Stack reference table
- Non-negotiable rules
- Project structure conventions (backend modules, frontend features)
- Workspace commands
- Reference docs table
- Context7 / library documentation instructions
- Skill loading mapping table
- Decision gates / no-assumptions policy
- Branching & commit conventions

**Additions:**
- Agent catalog section listing all 5 agents with their purpose, model, and tool scope
- Agent handoff flow diagram (the ASCII diagram from TL;DR section)
- Instructions for when to use the workflow agent vs. individual agents directly

---

## Phase 3 — Optional Session Context Hook

### Step 7: Session Context Hook (optional — create only if useful)

**File:** `.github/hooks/session-context.json`
**Script:** `.github/hooks/scripts/session-context.js`

**Hook type:** `SessionStart`

**Context to inject:**
- Current git branch
- Package manager: `pnpm`
- Node version
- Active workspace root
- Reminder: "Use EventKart agents for feature work. Start with `eventkart-workflow` or invoke individual agents directly."

**Decision:** Create this only if it demonstrably improves the agent experience. If it adds fragility or slows session startup, skip it.

---

## Phase 4 — Cleanup

### Step 8: Delete Redundant Prompt Files

**Delete after agents are verified and loading correctly:**

| File | Reason |
|------|--------|
| `.github/prompts/eventkart-feature-workflow.prompt.md` | Replaced by `eventkart-workflow` agent |
| `.github/prompts/eventkart-plan.prompt.md` | Replaced by `eventkart-planner` agent |
| `.github/prompts/eventkart-implement.prompt.md` | Replaced by `eventkart-implementer` agent |
| `.github/prompts/eventkart-review.prompt.md` | Replaced by `eventkart-code-reviewer` agent |
| `.github/prompts/_shared-conventions.md` | Replaced by `.github/agent-conventions.md` |

**Note:** Verify agents load correctly via Chat Customizations editor BEFORE deleting.

---

## Explicitly Out of Scope

| Item | Reason |
|------|--------|
| Biome format hook (`format.json`) | User excluded from scope |
| Migration utility prompt | User excluded utility prompts |
| Component scaffolding prompt | User excluded utility prompts |
| Test writing prompt | User excluded utility prompts |
| Debug/troubleshoot prompt | User excluded utility prompts |
| Hotfix prompt | User excluded utility prompts |

---

## Model Assignment Summary

| Agent | Model | Reasoning |
|-------|-------|-----------|
| `eventkart-workflow` | Default (not pinned) | Coordination only — no heavy reasoning needed |
| `eventkart-planner` | `claude-opus-4.6:defaultReasoningEffort=high`, fallback `claude-opus-4.7:defaultReasoningEffort=medium` | Best reasoning for architecture + planning decisions |
| `eventkart-plan-reviewer` | `gpt-5.5:defaultReasoningEffort=high` | Strong analytical review with high thinking |
| `eventkart-implementer` | `gpt-5.5:defaultReasoningEffort=high` | Strong implementation with high thinking |
| `eventkart-code-reviewer` | `gpt-5.5:defaultReasoningEffort=xhigh` | Deepest analysis for security, performance, standards review |

**Important:** These pins use Copilot CLI model IDs plus the supported `defaultReasoningEffort` model option. `claude-opus-4.7` was not available in the local model list at setup time; add it ahead of `claude-opus-4.6` if it becomes available.

---

## Files Summary

### To Create

| File | Type | Complexity |
|------|------|-----------|
| `.github/agents/eventkart-workflow.agent.md` | `[new]` | M |
| `.github/agents/eventkart-planner.agent.md` | `[new]` | L |
| `.github/agents/eventkart-plan-reviewer.agent.md` | `[new]` | M |
| `.github/agents/eventkart-implementer.agent.md` | `[new]` | L |
| `.github/agents/eventkart-code-reviewer.agent.md` | `[new]` | L |
| `.github/agent-conventions.md` | `[new]` | M |
| `.github/hooks/session-context.json` | `[new]` optional | S |
| `.github/hooks/scripts/session-context.js` | `[new]` optional | S |

### To Delete (after verification)

| File | Replaced By |
|------|-------------|
| `.github/prompts/eventkart-feature-workflow.prompt.md` | `eventkart-workflow` agent |
| `.github/prompts/eventkart-plan.prompt.md` | `eventkart-planner` agent |
| `.github/prompts/eventkart-implement.prompt.md` | `eventkart-implementer` agent |
| `.github/prompts/eventkart-review.prompt.md` | `eventkart-code-reviewer` agent |
| `.github/prompts/_shared-conventions.md` | `.github/agent-conventions.md` |

---

## Verification Checklist

1. [ ] Open VS Code Chat Customizations editor → Agents tab → all 5 agents visible
2. [ ] Run Chat Diagnostics → 0 YAML/frontmatter errors
3. [ ] Start orchestrator with a feature ID → it invokes planner (doesn't plan itself)
4. [ ] Planner runs with Claude Opus 4.6 and has NO edit tools
5. [ ] Planner auto-handoff → plan reviewer
6. [ ] Plan reviewer runs with GPT 5.5 High and produces approve/fix findings
7. [ ] Approved plan auto-handoff → implementer with GPT 5.5 High
8. [ ] Implementer auto-handoff → code reviewer with GPT 5.5 X High
9. [ ] Code reviewer covers: correctness, standards, reusability, security, privacy, performance, accessibility, web standards, tests
10. [ ] Code reviewer "Fix Issues" handoff loops back to implementer
11. [ ] Deleted prompt files no longer appear in `/` prompt list
12. [ ] If session-context hook created → appears in hook diagnostics, injects context without slowing startup

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent format | `.agent.md` in `.github/agents/` | VS Code native format for persistent personas with tool restrictions and handoffs |
| Orchestrator role | Coordination only | Separation of concerns — orchestrator should not do substantive work |
| Plan review stage | Dedicated agent | Independent review catches plan issues before implementation investment |
| Handoff mode | `send: true` for sequential flow | Automatic progression; decision gates in agent instructions handle user interaction |
| Prompt files | Delete after verification | Full migration to agents; no dual maintenance |
| Shared conventions | Move to `.github/agent-conventions.md` | Keep shared reference content outside `.github/agents/` so it is not loaded as an agent |
| Format hook | Not created | User excluded |
| Utility prompts | Not created | User excluded |
| Session context hook | Optional | Only if demonstrably useful |
