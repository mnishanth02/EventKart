# Workspace Foundation Implementation Plan

## Objective

Prepare the `eventkart` workspace for real product development by replacing the remaining starter-template scaffolding with a consistent, production-oriented foundation across:

- the Turbo monorepo
- the TanStack Start web app
- the Fastify API app
- shared configuration packages
- workspace linting, formatting, type-checking, env handling, and CI/task orchestration

This phase is intentionally limited to **workspace readiness**. It does **not** include feature modules, database scaffolding, or shared schema/database packages yet.

## Scope

### In scope

- unify formatting and linting around **Biome**
- standardize the workspace on **TypeScript 6.x**
- convert `apps\api` from the Fastify CLI JavaScript scaffold to a **TypeScript-first Fastify baseline**
- normalize package scripts and Turbo task wiring
- formalize **package-local environment variable handling**
- remove obsolete starter-era lint/config packages once migration is complete
- document the agreed workspace conventions in-repo

### Out of scope

- `packages\shared` creation
- `packages\db` creation
- Drizzle setup
- Redis/Postgres local infrastructure setup
- feature/domain module implementation
- auth, payments, bookings, or organizer/admin flows

## Confirmed decisions

| Topic                     | Decision                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| Monorepo lint/format tool | **Biome**                                                        |
| Type checking             | **TypeScript (`tsc --noEmit`)**                                  |
| Workspace TS policy       | **Standardize on TS 6.x**                                        |
| API runtime model         | **Direct TypeScript runtime**, not compiled build output         |
| Env file location         | **Per app/package**, not root `.env`                             |
| Web env strategy          | **Split public `VITE_` env and server-only env**                 |
| API env strategy          | **Typed config plugin with validated env**                       |
| ESLint config package     | **Remove during this phase** after Biome migration is complete   |
| Repo plan doc location    | **`docs\impl-plan\workspace-foundation-implementation-plan.md`** |
| Future shared packages    | **Defer `packages\shared` and `packages\db`**                    |
| TS conversion scope       | **Include support/config packages too**                          |

## Current state summary

### Root workspace

- Root `package.json` still reflects the generic Turbo starter.
- Root uses `prettier` even though the intended tool direction is Biome.
- Root `turbo.json` still contains starter-style assumptions that do not match this stack.

### `apps\web`

- already TypeScript-based
- already uses Biome
- already uses Vite + TanStack Start
- already contains a minimal T3 Env setup in `src\env.ts`
- still contains direct `import.meta.env` usage outside the canonical env module
- currently fails Biome linting, so the existing Biome setup is not yet a clean baseline

### `apps\api`

- still the default Fastify CLI JavaScript scaffold
- still CommonJS-based
- no `tsconfig.json`
- no typed app factory / server split
- no validated config plugin
- no Vitest baseline
- still uses `node --test`

### `packages\ui`

- TypeScript-based
- still linted via ESLint
- depends on `@repo/eslint-config`

### `packages\typescript-config`

- exists and is useful in principle
- still starter-oriented and needs to be reworked for the actual stack

### `packages\eslint-config`

- exists only to support the old linting path
- becomes obsolete once workspace Biome migration is finished

## Problems to solve

1. The workspace is using a **mixed toolchain** instead of a single, intentional baseline.
2. `apps\api` is not aligned with the TypeScript-first project direction.
3. Env handling is inconsistent and not yet split cleanly by runtime context.
4. Turbo tasks are not modeled around the actual package scripts and outputs.
5. The repo still contains starter assumptions that will create friction for all future work.

## Target end state

When this phase is complete, the workspace should behave like this:

- all relevant packages use **Biome** for formatting/linting
- all relevant packages use **TypeScript 6.x**
- the API runs from TypeScript directly in development and production-aligned runtime commands
- root scripts only delegate to **`turbo run <task>`**
- package scripts are normalized and consistent across apps/packages
- package-local env files and `.env.example` files exist where needed
- the web app has a **public env module** and a **server-only env module**
- the API has a **validated typed config layer**
- obsolete ESLint configuration packages are removed
- repo docs describe the foundation clearly for future implementation work

## Foundation principles

### 1. Biome for linting and formatting

Biome becomes the workspace standard for:

- formatting
- linting
- import organization

Biome is **not** the type checker.

### 2. TypeScript remains the type checker

TypeScript continues to own:

- type-checking
- project-level compiler configuration
- package type contracts

Target command pattern:

- `check-types`: `tsc --noEmit`

### 3. Package-local env ownership

No root `.env` file should be introduced.

Env ownership stays with the consuming app/package:

- `apps\web`
- `apps\api`

This keeps:

- cache invalidation localized
- ownership obvious
- secrets scoped properly
- accidental cross-app leakage lower

### 4. Package-task-first Turbo design

Tasks belong in package `package.json` files first.

Root scripts should only delegate through Turbo. Root should not contain package-specific task logic.

### 5. Fastify app factory + runtime entrypoint split

The API should follow a clean split:

- `src\app.ts` for the Fastify application factory
- `src\server.ts` for the runtime entrypoint

This keeps the API testable and aligned with Fastify best practices.

## Detailed implementation plan

## Phase 1: Audit and governance decisions

### Goals

- freeze the toolchain direction before making edits
- remove ambiguity around runtime/version choices
- explicitly mark non-goals

### Work

1. inventory current root/app/package dependencies related to:
   - Biome
   - ESLint
   - Prettier
   - TypeScript
   - Fastify runtime/testing
2. standardize the workspace on:
   - Node 22+
   - TypeScript 6.x
3. confirm direct TS runtime strategy for `apps\api`
4. decide whether pnpm `catalog:` adoption is included in this same pass
5. record out-of-scope items so later work does not drift

### Deliverables

- dependency/version inventory
- confirmed TS/runtime policy
- explicit scope boundary for deferred packages and infra

## Phase 2: Shared config package cleanup

### Goals

- make shared TS config match the real stack
- prepare the workspace for a repo-wide TS-first baseline

### Work

Rework `packages\typescript-config` into stack-aware presets such as:

- `base.json`
- `web.json` or equivalent Vite/TanStack Start config
- `fastify.json` or equivalent Node/Fastify config
- `react-library.json`

The updated config package should support:

- TypeScript 6.x
- modern module resolution appropriate to each package type
- `noEmit` flows where applicable
- direct-runtime API usage

Also:

- review support/config packages and convert remaining JS config code to TS where appropriate
- remove unused starter assumptions from config presets

### Deliverables

- updated `packages\typescript-config`
- migration plan for any package extending old configs

## Phase 3: Biome workspace standardization

### Goals

- make Biome the single lint/format baseline across the workspace
- remove package-by-package drift

### Work

1. add a **root Biome config** as the workspace source of truth
2. migrate `apps\web` Biome behavior into root config or root overrides
3. define path-based overrides only where necessary
4. normalize package scripts:
   - `lint`
   - `format`
   - `check`
5. explicitly ignore generated files and known non-source artifacts
6. decide how docs/Markdown formatting is handled when Prettier is removed

### Notes

- generated TanStack files should be excluded explicitly
- the web app already shows Biome issues; cleanup is part of this phase, not a later surprise

### Deliverables

- root `biome.json`/`biome.jsonc`
- migrated package scripts
- removal-ready state for Prettier and ESLint usage

## Phase 4: Package script normalization

### Goals

- establish a stable package-level task interface for Turbo

### Standard task surface

Every relevant package/app should expose the tasks that make sense for it:

| Task          | Purpose                        |
| ------------- | ------------------------------ |
| `dev`         | local development runtime      |
| `build`       | production build if applicable |
| `lint`        | Biome lint                     |
| `format`      | Biome format write path        |
| `check-types` | TypeScript type-check          |
| `test`        | test runner                    |

### Work

- align `apps\web`
- align `apps\api`
- align `packages\ui`
- ensure support/config packages expose only the tasks that actually apply

### Deliverables

- consistent package scripts
- no hidden starter-task assumptions in root

## Phase 5: Turbo task redesign

### Goals

- make Turbo reflect the actual package graph, outputs, and env behavior

### Current issues

- `build.outputs` still targets `.next/**`, which is wrong for this repo
- starter dependency wiring is not ideal for package-local lint/check tasks
- env handling needs to be modeled intentionally per task

### Work

1. redesign root `turbo.json` after package scripts are finalized
2. define task dependencies based on actual need, not starter defaults
3. declare outputs correctly by package type
4. declare env and inputs correctly:
   - `env` for named variables that affect task output
   - `inputs` for `.env` files and config files
5. align CI commands with the new package task model

### Expected direction by task

#### `lint`

- package-local
- should not force unnecessary upstream serialization

#### `check-types`

- should remain separate from lint
- cache behavior should be based on TS inputs/config

#### `build`

- outputs must reflect actual app/package build artifacts
- `apps\web` should use its real Vite/TanStack/Nitro output expectations
- source-only packages should not pretend to produce build artifacts

#### `dev`

- non-cacheable
- persistent where appropriate

### Deliverables

- corrected `turbo.json`
- root scripts aligned with package task model
- CI task invocation updated to match

## Phase 6: Web env and runtime configuration cleanup

### Goals

- make `apps\web` env handling explicit and runtime-safe

### Current issues

- env access is not fully centralized
- `import.meta.env` is still read directly in places
- current env module does not cleanly model TanStack Start public/server separation

### Work

Split env handling into two clear layers:

1. **public/client-safe env**
   - only `VITE_` values
   - safe for browser/runtime consumption

2. **server-only env**
   - secrets
   - internal-only values
   - server function/server runtime access only

Then:

- route all env usage through those modules
- remove direct `import.meta.env` reads from feature/integration code
- add `apps\web\.env.example`
- document required variables

### Initial web env contract

The exact list can evolve, but the foundation doc should support variables like:

| Variable            | Scope       | Notes                                 |
| ------------------- | ----------- | ------------------------------------- |
| `VITE_APP_TITLE`    | public      | already present conceptually          |
| `VITE_POSTHOG_KEY`  | public      | currently used directly               |
| `VITE_POSTHOG_HOST` | public      | currently used directly               |
| `INTERNAL_API_URL`  | server-only | future SSR/internal API communication |
| `SERVER_URL`        | server-only | already modeled in current env setup  |

### Deliverables

- split env modules
- centralized env access
- `apps\web\.env.example`

## Phase 7: Fastify API TypeScript baseline

### Goals

- replace the JS starter with a clean, testable, TypeScript-first Fastify foundation

### Target structure

`apps\api\src\` should move toward a shape like:

```text
src/
  app.ts
  server.ts
  plugins/
  routes/
  lib/
```

### Required baseline pieces

- `app.ts` application factory
- `server.ts` entrypoint
- typed plugin registration
- typed route registration
- config plugin
- health/readiness endpoints
- `trustProxy` setup
- Vitest + `app.inject()` testing baseline
- direct TS dev/runtime commands

### Work

1. remove stock Fastify CLI scaffold files
2. add API `tsconfig.json`
3. migrate package.json scripts to the normalized package-task model
4. introduce direct TS runtime/watch workflow
5. replace example routes/tests with foundation-grade health/config/testing surfaces

### API baseline expectations

The goal here is not feature implementation. The goal is a clean starting point for later feature work.

### Deliverables

- TS-first Fastify app baseline
- normalized scripts
- testable app factory

## Phase 8: API env strategy

### Goals

- make API runtime configuration validated, typed, and app-local

### Work

1. add a typed config plugin for the Fastify app
2. validate env at startup
3. add `apps\api\.env.example`
4. document the first baseline variables

### Initial API env contract

The exact set may evolve during implementation, but the baseline should support variables such as:

| Variable                         | Purpose                               |
| -------------------------------- | ------------------------------------- |
| `PORT`                           | listen port                           |
| `HOST`                           | listen host                           |
| `LOG_LEVEL`                      | runtime logging level                 |
| `WEB_ORIGIN` or equivalent       | CORS/origin config                    |
| `INTERNAL_API_KEY` or equivalent | future internal SSR/app communication |

Future secrets for database/session/Redis/etc. are **not** part of this foundation pass unless required by the chosen baseline.

### Deliverables

- validated config plugin
- package-local env examples
- documented API env contract

## Phase 9: Tooling cleanup and removal work

### Goals

- remove no-longer-needed starter tooling after replacement coverage is complete

### Removal candidates

- `packages\eslint-config`
- ESLint dependencies no longer used anywhere
- root Prettier and related config/dependencies if Biome fully replaces its use
- starter README language that no longer reflects the repo

### Guardrail

Remove old tooling only after:

- Biome is working across relevant packages
- Type-check scripts are wired
- Turbo tasks reflect the new task model

## Phase 10: Documentation and onboarding deliverables

### Goals

- leave the repo with clear guidance for future implementation work

### Work

- create this workspace-foundation plan doc
- update root README starter language
- update CI/task usage docs if scripts changed
- document env variables and examples
- document the final toolchain choices and package responsibilities

### Required repo-facing documentation topics

- why Biome is the workspace standard
- why `tsc --noEmit` remains separate
- package-local env ownership
- TanStack Start env split
- Fastify runtime/config/testing baseline
- Turbo task conventions
- removed/deprecated starter tooling

## Package-by-package change summary

| Package                      | Planned change                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Root                         | clean scripts, remove starter tooling assumptions, update Turbo config, update docs |
| `apps\web`                   | centralize env handling, keep Biome, clean Biome issues, align scripts              |
| `apps\api`                   | convert from JS scaffold to TS-first Fastify baseline                               |
| `packages\ui`                | migrate from ESLint to Biome, align TS/scripts                                      |
| `packages\typescript-config` | rework for actual stack and TS 6.x                                                  |
| `packages\eslint-config`     | remove during this phase                                                            |

## Risks and attention points

1. **Biome adoption is not just config work**
   - existing code already fails Biome in `apps\web`

2. **Biome does not replace TS type-checking**
   - `check-types` must stay explicit

3. **TypeScript 6.x is a real migration**
   - package config, Fastify typing, and supporting tooling may need adjustments

4. **API migration is effectively a scaffold replacement**
   - runtime, tests, watch mode, and structure all change together

5. **Prettier removal needs a deliberate Markdown/docs story**
   - do not remove it blindly if docs formatting would regress

6. **Future shared packages are intentionally deferred**
   - this plan should not silently grow into schema/db setup work

## Success criteria

This phase is complete when:

- the workspace has a single lint/format direction based on Biome
- the workspace is standardized on TypeScript 6.x
- `apps\api` is no longer a Fastify JS starter app
- package scripts are normalized and Turbo is wired to them correctly
- env handling is package-local and documented
- `.env.example` files exist where needed
- obsolete ESLint config infrastructure is removed
- root docs no longer describe the repo as a generic Turbo starter

## Implementation order

1. audit and governance decisions
2. shared config cleanup
3. Biome workspace standardization
4. package script normalization
5. Turbo task redesign
6. web env cleanup
7. API TypeScript baseline
8. API env strategy
9. tooling cleanup
10. docs and onboarding updates

## Guardrails

- Do not add `packages\shared` or `packages\db` in this phase.
- Do not collapse linting and type-checking into one tool.
- Do not introduce a root `.env`.
- Do not keep starter defaults just because they already exist.
- Do not expand this phase into feature implementation.

## Final outcome of this phase

After this plan is implemented, the repo should be ready for actual application work with:

- a deliberate monorepo toolchain
- a TS-first API baseline
- a consistent web/api env model
- a clean Turbo task system
- repo docs that match reality instead of starter scaffolding
