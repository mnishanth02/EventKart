# EventKart workspace

EventKart is a pnpm + Turborepo monorepo with a TanStack Start frontend, a Fastify API, shared UI primitives, and shared TypeScript presets. The workspace foundation is now aligned to the actual stack instead of the original Turborepo starter defaults.

## Workspace layout

| Path                         | Responsibility                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`                   | TanStack Start frontend on Vite for public discovery, booking, dashboards, and SSR/CSR route handling |
| `apps/api`                   | TypeScript-first Fastify API baseline with typed runtime config and inject-based tests                |
| `packages/ui`                | Shared React UI primitives                                                                            |
| `packages/typescript-config` | Shared TypeScript presets for the web app, Fastify API, and React libraries                           |
| `docs`                       | Product, requirements, architecture, and implementation guidance                                      |

## Local requirements

- Node.js `>=22.12.0`
- pnpm `9`

## Getting started

1. Install dependencies:

```sh
pnpm install
```

2. Copy the package-local env examples:

```sh
Copy-Item apps\web\.env.example apps\web\.env.local
Copy-Item apps\api\.env.example apps\api\.env
```

3. Start the API and frontend:

```sh
pnpm --filter api dev
pnpm --filter web dev
```

The default local setup uses `http://localhost:3000` for the web app and `http://localhost:3001` for the API.

You can also run `pnpm dev` from the repo root to let Turbo orchestrate persistent dev tasks.

## Workspace commands

| Command            | What it covers                                                                |
| ------------------ | ----------------------------------------------------------------------------- |
| `pnpm format`      | Package formatting plus root-owned files and Markdown docs                    |
| `pnpm lint`        | Biome lint across workspace packages plus root-owned files                    |
| `pnpm check`       | Biome full checks across workspace packages plus root-owned files             |
| `pnpm check-types` | `tsc --noEmit` across the packages that own TypeScript compilation boundaries |
| `pnpm test`        | Vitest package test suites                                                    |
| `pnpm build`       | Production builds for deployable packages                                     |

## Toolchain conventions

### Biome is the workspace standard

Biome is the default formatter and linter for the TypeScript workspace:

- package scripts use `biome lint .`, `biome format --write .`, and `biome check .`
- the root `biome.json` is the single shared config
- the old `packages/eslint-config` starter package has been removed

### Why `tsc --noEmit` stays separate

Biome covers formatting, import organization, and lint rules. It does **not** replace TypeScript's project-wide type analysis, so `check-types` remains a dedicated `tsc --noEmit` task for the web app, API, and shared packages.

### Why Prettier is still present

Prettier remains at the root for `format:docs` only. Code formatting is handled by Biome, but Markdown formatting stays on Prettier until Biome's Markdown support is mature enough for the repo's docs workflow.

### Turbo task conventions

Workspace packages expose a consistent task surface:

- `lint`
- `format`
- `check`
- `check-types`
- `test`
- `build` where applicable

Root-only files are handled through Turbo root tasks in `turbo.json`, so `package.json`, `turbo.json`, `biome.json`, and Markdown docs are still part of the normal workspace pipeline.

## Environment ownership

Environment files are package-local. Do not centralize env files at the repo root.

| Package    | Local example                                   | Ownership model                                                 |
| ---------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `apps/web` | `apps/web/.env.example` → `apps/web/.env.local` | Public `VITE_*` values plus server-only frontend runtime values |
| `apps/api` | `apps/api/.env.example` → `apps/api/.env`       | Fastify runtime config owned by the API service                 |

### `apps/web` env split

The frontend uses two explicit env layers:

- `apps/web/src/lib/env/public.ts` for client-safe `VITE_*` variables
- `apps/web/src/lib/env/server.ts` for server-only values such as `INTERNAL_API_URL` and `SERVER_URL`

Do not read `import.meta.env` directly outside the env layer. Import `publicEnv` or `serverEnv` instead so the SSR/client boundary stays explicit.

### `apps/api` runtime config

The API validates runtime config in `apps/api/src/lib/config.ts` and exposes it through the Fastify config plugin.

Current baseline variables:

- `HOST`
- `PORT`
- `LOG_LEVEL`
- `WEB_ORIGIN`
- `INTERNAL_API_KEY` (optional)

Blank optional values are normalized away, and `WEB_ORIGIN` must be an absolute origin without a path, query, or hash.
The local defaults keep the frontend on port `3000` and the API on port `3001`.

## Frontend baseline

`apps/web` is a TanStack Start app running on Vite, not Next.js.

- Public discovery surfaces are SSR-first
- Authenticated dashboard flows use the route model defined in the workspace plan
- env access is centralized through the dedicated env modules
- package validation is `biome` + `tsc --noEmit` + `vitest`

See `apps/web/README.md` for web-specific conventions.

## API baseline

`apps/api` is a TypeScript-first Fastify v5 app.

- `src/app.ts` owns the app factory
- `src/server.ts` is the runtime entrypoint
- `src/plugins/config.ts` decorates typed config onto the Fastify instance
- tests use Vitest with `app.inject()` via `apps/api/test/helpers/build-app.ts`

This keeps runtime boot, configuration, and tests aligned with Fastify's testable app-factory pattern.

## Starter tooling removed

The workspace no longer uses:

- the original Turborepo starter README assumptions
- the `packages/eslint-config` workspace package
- repo-wide ESLint config as part of the active toolchain

The remaining starter-plan references in `docs/impl-plan/workspace-foundation-implementation-plan.md` are historical planning context only.

## Additional docs

- `docs/architecture.md`
- `docs/requirements.md`
- `docs/product-plan.md`
- `docs/implementation-plan.md`
- `docs/impl-plan/workspace-foundation-implementation-plan.md`

## Deployment

EventKart deploys to two Railway projects (`eventkart-staging`,
`eventkart-production`), each with five services
(`postgres`, `redis`, `api`, `web`, `worker`) in the Singapore region.
Cloudflare proxies the `web` service only; the `api` service is reached
directly to preserve the cookie-cache invariant in
`apps/api/src/plugins/auth.ts`.

- Operations runbook (provisioning, env-var matrix, DNS, rotation,
  rollback, smoke tests, cost guardrails):
  [`docs/operations/railway-deployment-setup.md`](docs/operations/railway-deployment-setup.md)
- Implementation plan + risk register:
  [`docs/impl-plan/infrastructure-railway-deployment.md`](docs/impl-plan/infrastructure-railway-deployment.md)
- Cloudflare zone, cache rules, and the SSR cache contract:
  [`docs/operations/cloudflare-cdn-setup.md`](docs/operations/cloudflare-cdn-setup.md)
