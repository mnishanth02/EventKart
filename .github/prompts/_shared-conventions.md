# EventKart Shared Conventions

> This file is referenced by all EventKart prompt files. It is NOT a standalone prompt.
> Edit conventions here once — all prompts inherit automatically.

## Stack

- **Monorepo:** pnpm 10 + Turborepo
- **Frontend:** TanStack Start (React 19, Vite) — `apps/web`
- **Backend:** Fastify v5 (TypeScript) — `apps/api`
- **Database:** Drizzle ORM, PostgreSQL (via PgBouncer) — `packages/db`
- **Shared:** Zod schemas, types, constants — `packages/shared`
- **UI:** shadcn/ui v4, Tailwind v4 — `packages/ui`

## Non-Negotiable Rules

| Rule                       | Details                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| pnpm only                  | Never npm or yarn                                                                                         |
| Biome                      | Lint + format for TS/JS (tabs, double quotes). Prettier only for Markdown. Never ESLint/Prettier for code |
| Vitest                     | Never Jest                                                                                                |
| Tailwind v4                | CSS-first — no `tailwind.config.js`                                                                       |
| Zod v4                     | All validation, shared via `packages/shared`                                                              |
| TypeScript strict          | `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                          |
| React Compiler             | Avoid manual `useMemo`/`useCallback`                                                                      |
| Server-side enforcement    | Security/access control at API layer, never UI-only                                                       |
| Env access                 | `fastify.config.*` (API) or `publicEnv`/`serverEnv` (web) — never raw `import.meta.env`                   |
| HTTP only between apps     | `apps/web` and `apps/api` never import from each other                                                    |
| Shared UI in `packages/ui` | Never duplicate components in apps                                                                        |

## Project Structure Conventions

**Backend modules** — `apps/api/src/modules/<domain>/`:

```
routes.ts       # Route definitions with Zod schemas + preHandlers
service.ts      # Business logic (testable without HTTP)
schemas.ts      # Zod request/response schemas
types.ts        # Module-specific types
```

**Frontend features** — `apps/web/src/features/<domain>/`:

```
api.ts          # createServerFn wrappers
queries.ts      # queryOptions() factories
components/     # Feature-specific components
hooks.ts        # Custom hooks
types.ts        # Client-safe types
```

## Workspace Commands

```sh
# Scoped (prefer these)
pnpm --filter <workspace> dev
pnpm --filter <workspace> test
pnpm --filter <workspace> lint
pnpm --filter <workspace> check-types

# Repo-wide
pnpm build | lint | test | check-types
```

## Reference Docs (Read Before Coding)

| File                                                   | Purpose                                     |
| ------------------------------------------------------ | ------------------------------------------- |
| `docs/v1-implementation-plan.md`                       | Feature specs, IDs, dependency chains       |
| `docs/requirements.md`                                 | Product requirements (F-IDs)                |
| `docs/architecture.md`                                 | System architecture decisions               |
| `.github/copilot-instructions.md`                      | Repo-wide rules (always read)               |
| `.github/instructions/fastify-backend.instructions.md` | API patterns, auth, rate limiting           |
| `.github/instructions/tanstack-start.instructions.md`  | Frontend patterns, SSR modes, data fetching |

## Fetching Library Documentation

Use the **Context7 MCP** tools to fetch up-to-date docs for any library involved in the feature:

1. `resolve-library-id` — resolve the library name to a Context7-compatible ID
2. `get-library-docs` — fetch current documentation for the resolved ID

**Priority libraries to check:** `fastify` (v5), `drizzle-orm`, `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-form`, `zod` (v4), `bullmq`, `razorpay`, `resend`.

If fetched docs contradict a local skill or instruction file, prefer the latest library docs and note the divergence.

## Loading Skills

Read applicable skill files from `.agents/skills/<skill>/SKILL.md` based on the feature domain:

| Feature Domain             | Skill(s)                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| API route/plugin           | `fastify-best-practices`                                          |
| Database schema/migration  | `drizzle`                                                         |
| Frontend route/component   | `tanstack-start-best-practices`, `tanstack-router-best-practices` |
| Forms                      | `tanstack-form`                                                   |
| Data fetching/caching      | TanStack Query (global skills)                                    |
| Zod schemas                | `zod`                                                             |
| UI components              | `tailwind-v4-shadcn`                                              |
| Redis usage                | `redis-development`                                               |
| Auth, user input, payments | `owasp-security` (always load for these)                          |
| Tests                      | Vitest (global skills)                                            |

If a skill file doesn't exist at the expected path, skip it and rely on Context7 docs + instruction files instead.

## Decision Gates — No Assumptions Policy

**Core rule: NEVER assume — always ask.**

When you encounter ANY of the situations below, you MUST stop and ask the user before proceeding. Do NOT make a best-guess decision and continue. Present the options clearly, explain the trade-offs briefly, and wait for an explicit answer.

### Universal Gates (apply to ALL prompts)

1. **Ambiguous requirements:** If a feature spec, acceptance criterion, or task description can be interpreted in more than one way — ask which interpretation is correct.
2. **Missing information:** If you need a value, name, behavior, or decision that isn't specified in the plan, docs, or code — ask. Never invent defaults for business logic.
3. **Multiple valid approaches:** If there are 2+ reasonable ways to implement something (e.g., polling vs. WebSocket, server component vs. client component, one endpoint vs. two) — present the options with trade-offs and ask.
4. **Scope creep detection:** If implementing a feature naturally requires touching something outside the requested scope (e.g., refactoring a shared utility, adding a new package, modifying an unrelated module) — describe what you found and ask whether to include it or defer.
5. **Breaking changes:** If your change would break an existing API contract, database schema, or UI behavior — stop immediately, describe the impact, and ask how to proceed.
6. **Dependency decisions:** If a feature needs a new dependency not already in the project — ask before installing. Present the package name, what it does, and whether a lighter alternative exists.
7. **Convention conflicts:** If library docs recommend a pattern that conflicts with the project's conventions (instruction files, skill files) — present both approaches and ask which to follow.

### Planning Phase Gates

8. **Prerequisite strategy:** When prerequisites are missing, ask: include them, stub them, or build them first? (Never silently include extra work.)
9. **Scope sizing:** If the requested scope is large (>10 tasks), propose a split and ask the user to confirm the chunking.
10. **Schema design decisions:** For non-obvious choices like column types, enum values, relationship cardinality, or index strategy — present your reasoning and ask for confirmation.
11. **SSR mode selection:** If the correct SSR mode for a new route isn't obvious from the decision table — ask.

### Implementation Phase Gates

12. **Deviating from the plan:** If during implementation you discover the plan needs changes (wrong assumption, missing step, better approach) — stop, explain the issue, propose the change, and wait for approval. Never silently deviate.
13. **Error interpretation:** If `check-types`, `lint`, or `test` failures have multiple possible fixes — describe the options and ask which fix to apply. Only auto-fix when there's exactly one obvious correction (e.g., missing import, typo).
14. **Test strategy:** If it's unclear what error paths to test or what constitutes an edge case for a specific feature — ask what scenarios matter most.

### Review Phase Gates

15. **Severity judgment:** If you're unsure whether a finding is Critical vs. Improvement — present it and ask the user to classify.
16. **Fix scope:** Before auto-fixing, confirm the scope: _"I'll fix these N issues. This will touch files X, Y, Z. Proceed?"_

### How to Ask

When stopping at a gate, use this format:

```
🔶 **Decision needed: [short title]**

[1-2 sentence context — what you're trying to do and why you stopped]

**Options:**
1. [Option A] — [trade-off]
2. [Option B] — [trade-off]
3. [Option C, if applicable] — [trade-off]

Which approach should I take?
```

Do NOT bundle multiple unrelated decisions into one question — ask them separately so each gets a clear answer.

## Branching & Commits

- **Branch naming:** `feat/<module>-<short-description>` (e.g., `feat/auth-otp-login`)
- **Commits:** conventional commits — `feat:`, `fix:`, `chore:`, `refactor:`, `test:`
- **One feature per branch** — keep PRs focused
