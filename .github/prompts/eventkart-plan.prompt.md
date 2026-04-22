---
agent: plan
description: 'EventKart: Create a detailed implementation plan for selected features from v1-implementation-plan.md'
argument-hint: 'Feature IDs or module name from docs/v1-implementation-plan.md'
tools: ['search/codebase', 'web/fetch', 'web/githubRepo', 'openSimpleBrowser', 'read/problems', 'search', 'searchResults', 'search/usages']
---
# Plan Feature Implementation

You are a senior architect planning a production-ready feature for EventKart.

> Read `.github/prompts/_shared-conventions.md` FIRST for stack details, rules, reference docs, and **Decision Gates**.
> **You MUST follow the No Assumptions Policy** — stop and ask the user at every decision gate. Never guess.

## Input

The user will specify feature IDs or a module from `docs/v1-implementation-plan.md`:
**Features:** ${input:featureIDs}

## Process

### 1. Load Context (Do ALL of these FIRST)

1. Read `docs/v1-implementation-plan.md` — locate the exact features requested.
2. Read `docs/requirements.md` — find the matching F-IDs for product context.
3. Read `docs/architecture.md` — understand system constraints.
4. Read `.github/copilot-instructions.md` — repo-wide rules.
5. Read `.github/instructions/fastify-backend.instructions.md` if backend work is involved.
6. Read `.github/instructions/tanstack-start.instructions.md` if frontend work is involved.
7. Read applicable skill files per the mapping in `_shared-conventions.md`.

### 2. Research Latest Best Practices

Use **Context7 MCP** (`resolve-library-id` → `get-library-docs`) to fetch current documentation for every library the feature touches. See `_shared-conventions.md` for the priority library list.

If a library API has changed since the skill file was written, note the difference and prefer the latest docs.

### 3. Dependency Analysis

- Trace ALL prerequisite feature IDs from the implementation plan.
- Scan the current codebase to determine which prerequisites are already implemented.
- Flag any missing prerequisites that must be built first.
- If the requested scope spans more than **10 tasks**, recommend splitting into smaller planning chunks and ask the user how they want to divide it.

### 4. Generate the Implementation Plan

Create the plan file at: `docs/impl-plan/feature-<module>-<feature-ids>.md`

**Naming convention:** Use the module number and hyphen-separated feature IDs.
Examples: `feature-0.2-I-0.2.1-I-0.2.2.md`, `feature-1.3-auth-otp.md`

The plan MUST include ALL of the following sections:

#### 4a. Requirements
- Map each feature ID to specific, verifiable acceptance criteria.
- Security requirements (OWASP Top 10 relevant items).
- Privacy requirements (DPDPA compliance where personal/sensitive data is handled).
- Performance targets: use the baselines from `docs/architecture.md` (e.g., API p95 < 200ms, SSR TTFB < 300ms). If no baseline exists, leave as "TBD — measure after implementation."

#### 4b. Implementation Steps (per phase)
For EACH task, specify:
- **Exact file path** to create or modify
- **What the file does** in one sentence
- **Key implementation details** — schema shape, endpoint signature, component props
- **Dependencies** on other tasks (within and across phases)
- **Complexity estimate:** S (< 1 hour), M (1–4 hours), L (4+ hours) — relative, not a prediction

#### 4c. Database Schema
- Full Drizzle table definitions with column types, defaults, indexes, constraints.
- Migration strategy: for NEW tables, standard create. For EXISTING tables, use expand/contract pattern (add nullable column → backfill → add constraint).

#### 4d. API Endpoints
- Method, path, auth requirement, rate limit tier
- Zod request schema (params, query, body)
- Zod response schema
- Error responses with status codes (400, 401, 403, 404, 409, 429)

#### 4e. Frontend Routes & Components
- Route path, SSR mode (from the SSR decision table in `tanstack-start.instructions.md`), layout group
- Data loading strategy (loader vs. query)
- Key components with their props interface
- Form validation approach (TanStack Form + Zod from shared)

#### 4f. Testing Plan
- List every test file with what it validates
- API tests: happy path, auth failures (401/403), validation errors (400), not found (404), edge cases
- Frontend tests: component rendering, user interactions, error states
- Minimum: happy path + 2 error paths per endpoint

#### 4g. Files Summary
- Complete list of every file to create or modify, grouped by workspace
- Mark each as `[new]` or `[modify]`

### 5. Present the Plan

Show the plan to the user for review. Explicitly ask:
- _"Should I adjust the scope, split into smaller chunks, or proceed to implementation?"_

## Output Quality Gates

The plan is NOT ready until it:
- [ ] Has zero ambiguous tasks — every task has an exact file path and clear deliverable
- [ ] Traces all dependency chains — no missing prerequisites
- [ ] Includes security considerations for every endpoint that handles user input
- [ ] Includes test coverage plan for every new file
- [ ] References the correct library versions from `package.json`
- [ ] Follows all conventions from the instruction files and `_shared-conventions.md`
- [ ] Has complexity estimates for each task
