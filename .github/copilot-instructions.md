# EventKart — Copilot Instructions

EventKart is a pnpm + Turborepo monorepo for an event ticketing platform. The frontend is a TanStack Start app (React 19, Vite), the backend is a Fastify v5 TypeScript API, and shared UI components live in `packages/ui`.

## Scoped Instructions

Domain-specific patterns for each app are in dedicated instruction files — always follow them when editing code in those areas:

- **`apps/api/`** → `.github/instructions/fastify-backend.instructions.md`
- **`apps/web/`** → `.github/instructions/tanstack-start.instructions.md`

This file covers **repo-wide** rules only.

## Planned Feature Workflow

For feature implementation from `docs/impl-plan/` or `docs/v1-implementation-plan.md`, use the existing Anvil agent/autopilot workflow with the single prompt at `.github/prompts/eventkart-dev-workflow.prompt.md`.

## Package Boundaries

| Package                      | Purpose                                   | Import as                                                     |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `apps/web`                   | TanStack Start frontend (SSR + CSR)       | —                                                             |
| `apps/api`                   | Fastify v5 REST API                       | —                                                             |
| `packages/ui`                | Shared shadcn/ui components, hooks, utils | `@repo/ui/components/*`, `@repo/ui/lib/*`, `@repo/ui/hooks/*` |
| `packages/typescript-config` | Shared tsconfig presets                   | `@repo/typescript-config`                                     |

- Never import directly between `apps/web` and `apps/api` — they communicate via HTTP only.
- Shared UI goes in `packages/ui`. Don't duplicate shared components inside an app.
- When adding shadcn/ui components, install into `packages/ui` (it has its own `components.json`).

## Component Placement (read this BEFORE creating any UI file)

**Rule 1 — Reuse before you create.** Before writing a new component, hook, or
helper, search for an existing one. The order to look is:

1. `packages/ui/src/components/ui/` — shadcn primitives (Button, Card, Dialog, …).
2. `packages/ui/src/components/` — shared non-shadcn primitives (theme-toggle, verified-badge).
3. `packages/ui/src/hooks/` and `packages/ui/src/lib/` — shared hooks and utils.
4. `apps/web/src/components/design-system/` — app-level design-system primitives
   (`CurrencyINR`, `GlassSurface`, `BentoGrid`, `toastUndo`, …).
5. `apps/web/src/components/{layout,loading,error}/` — app-level shared chrome.
6. `apps/web/src/features/<domain>/components/` — feature-specific components.

If something close already exists, **extend it**. Never duplicate.

**Rule 2 — Where new code goes.** Use this decision tree:

| What you're adding                                                      | Goes in                                            |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| A generic shadcn primitive (no app-specific logic)                      | `packages/ui/src/components/ui/`                   |
| A generic, reusable hook or util (no app deps)                          | `packages/ui/src/hooks/` or `packages/ui/src/lib/` |
| An app-level design-system primitive (composes shadcn, no domain logic) | `apps/web/src/components/design-system/`           |
| App chrome (header, footer, sidebar, error/loading)                     | `apps/web/src/components/{layout,error,loading}/`  |
| A component tied to one domain (events, organizer, …)                   | `apps/web/src/features/<domain>/components/`       |

**Hard rule:** `packages/ui` is for code that could plausibly ship to a second
app. App-specific composites, domain logic, and route-aware components do
**not** belong there. If you're tempted to import from `@tanstack/react-router`,
`@repo/db`, or anything under `apps/web/src/features/` from inside
`packages/ui`, stop — the file is in the wrong package.

## Commands

All commands run from the repo root with `pnpm`. Use `--filter` to target a workspace:

```sh
pnpm install                          # install all dependencies
pnpm dev                              # start all apps (Turbo orchestrated)
pnpm --filter api dev                 # start API only (localhost:3001)
pnpm --filter web dev                 # start web only (localhost:3000)
pnpm build                            # production build
pnpm lint                             # Biome lint across workspace
pnpm check-types                      # tsc --noEmit across workspace
pnpm test                             # Vitest across workspace
pnpm --filter api test                # tests for API only
pnpm --filter web test                # tests for web only
```

Run a single test file:

```sh
pnpm --filter api exec vitest run test/routes/health.test.ts
pnpm --filter web exec vitest run src/components/Button.test.tsx
```

After making changes, run the relevant checks for affected workspace(s): `test`, `lint`, and/or `check-types`.

## Architecture

- **Modular monolith**: The API is a single deployable unit with domain modules under `apps/api/src/modules/`. Each module owns its routes, service logic, and schemas.
- **App factory pattern**: `apps/api/src/app.ts` builds the Fastify instance (testable, no listen). `apps/api/src/server.ts` is the runtime entrypoint.
- **Hybrid API communication**: SSR server functions call the API over an internal network URL (`INTERNAL_API_URL`). Browser code calls the public API. Never hardcode API URLs — use the env layer.
- **Feature-first frontend**: `apps/web/src/features/<domain>/` organizes code by domain, not by layer. Each feature has `api.ts`, `queries.ts`, `components/`, `hooks.ts`, `types.ts`.

## Tooling Guardrails

- **pnpm only** — never use npm or yarn.
- **Biome** is the linter and formatter for all TypeScript/JavaScript. Do not introduce ESLint or Prettier for code files. Formatter uses tabs and double quotes.
- **Prettier** is used only for Markdown files (`pnpm format:docs`).
- **Vitest** is the test runner. Do not introduce Jest.
- **Tailwind v4** uses CSS-first configuration. There is no `tailwind.config.js` — do not create one.
- **React Compiler** is enabled via the Vite babel plugin. Avoid manual `useMemo`/`useCallback` unless profiling shows the compiler is insufficient.
- **TypeScript 6+** with `strict: true`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

## Environment Variables

Env files are package-local — never centralize them at the repo root.

| Package    | Example file   | Local file   |
| ---------- | -------------- | ------------ |
| `apps/web` | `.env.example` | `.env.local` |
| `apps/api` | `.env.example` | `.env`       |

In `apps/web`, access env through `publicEnv` (client-safe `VITE_*` values) or `serverEnv` (server-only) — never read `import.meta.env` directly. In `apps/api`, config is validated in `src/lib/config.ts` and decorated onto the Fastify instance via the config plugin — access it as `fastify.config.*`.

## Testing

- **API tests**: Vitest + `app.inject()`. Use the `buildTestApp()` helper from `test/helpers/build-app.ts`. Always `app.close()` in `afterAll`. Test files live in `apps/api/test/`.
- **Web tests**: Vitest + jsdom. Test files are colocated in `apps/web/src/` as `*.test.{ts,tsx}`.

## Node and Package Versions

- Node.js `>=22.12.0`
- pnpm `10.33.2`
- Fastify v5, Zod v4, React 19, TanStack Start RC (pin exact versions)
