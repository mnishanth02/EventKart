---
goal: Separate deployment topology for EventKart web and API services with explicit API production build support
version: 1.0
date_created: 2026-04-21
last_updated: 2026-04-21
owner: Engineering
tags: [infrastructure, architecture, deployment, api, web]
---

# Introduction

This plan defines the changes required to operate `apps/web` and `apps/api` as separate deployable services while preserving the existing hybrid communication model documented in the architecture. The primary implementation gap is that `apps/api` does not currently expose a production `build` task even though it is intended to be deployed as its own backend service.

## 1. Requirements & Constraints

- **REQ-001**: Keep `apps/web` and `apps/api` as separate deployable services.
- **REQ-002**: Preserve the documented hybrid communication model: SSR server-to-server calls use `INTERNAL_API_URL`; browser calls use the public API origin.
- **REQ-003**: Ensure `pnpm build` from the monorepo root runs a real build for every deployable package.
- **REQ-004**: Ensure the API produces a deterministic production artifact suitable for deployment.
- **REQ-005**: Keep package-local environment ownership; do not introduce a repo-root `.env` file.
- **SEC-001**: Session cookies must remain scoped to the parent domain (for example `.eventkart.app`) so the browser can send them to both frontend and backend origins.
- **SEC-002**: Fastify CORS must explicitly allow the deployed web origin and use `credentials: true`.
- **SEC-003**: Server-only frontend environment values must stay in `apps/web/src/lib/env/server.ts` and must not leak to client bundles.
- **CON-001**: `apps/api` currently extends a shared TypeScript config with `noEmit: true`; a dedicated build config is required for emitted JS.
- **CON-002**: `apps/api` currently uses `tsx` for local runtime and has no `build` script.
- **CON-003**: `apps/web` already has a production build via Vite and should remain independently deployable.
- **GUD-001**: Prefer minimal changes that preserve the current development workflow (`pnpm --filter api dev`, `pnpm --filter web dev`).
- **PAT-001**: Treat deployable packages as packages with explicit `build` scripts and Turbo task outputs.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Add a production build pipeline for `apps/api` without changing the local development workflow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `apps/api/tsconfig.build.json` extending `apps/api/tsconfig.json` with `compilerOptions.noEmit=false`, `compilerOptions.outDir="dist"`, `compilerOptions.rootDir="src"`, and `include` limited to `src/**/*.ts` and `src/**/*.d.ts`. |  |  |
| TASK-002 | Add `build` script to `apps/api/package.json` using `tsc -p tsconfig.build.json`. |  |  |
| TASK-003 | Add `start:prod` script to `apps/api/package.json` using `node dist/server.js`. Keep `dev` unchanged. |  |  |
| TASK-004 | Add `apps/api/turbo.json` extending `//` and configure `build.outputs` as `dist/**`. |  |  |
| TASK-005 | Run `pnpm build` from the repo root and verify that Turbo runs `web#build` and `api#build` with non-empty commands. |  |  |

### Implementation Phase 2

- GOAL-002: Make the cross-service contract explicit for production deployment.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Add `PUBLIC_API_URL` to `apps/web/.env.example` for browser-side API calls if browser traffic will target a production API hostname distinct from the web origin. |  |  |
| TASK-007 | Update the frontend API client implementation to select `INTERNAL_API_URL` on the server and `PUBLIC_API_URL` in the browser, falling back to the current local defaults only in development. |  |  |
| TASK-008 | Verify `apps/api/src/lib/config.ts` accepts the deployed `WEB_ORIGIN` value and that the deployed Fastify CORS config allows credentialed requests from the web hostname. |  |  |
| TASK-009 | Document the production service URLs, cookie domain, and SSR-to-API request forwarding behavior in `README.md` or a deployment doc under `docs/`. |  |  |

### Implementation Phase 3

- GOAL-003: Prepare deployment workflows for separate services.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Create a deployment target definition for `apps/web` that runs the package `build` command and serves the generated frontend output using the selected platform adapter. |  |  |
| TASK-011 | Create a deployment target definition for `apps/api` that runs the package `build` command and starts the service with `pnpm --filter api start:prod` or equivalent platform start command. |  |  |
| TASK-012 | Add CI validation that runs `pnpm build`, `pnpm test`, and `pnpm check-types` before either service is deployed. |  |  |
| TASK-013 | Reserve a follow-up infrastructure task for a separate worker service when BullMQ queues are introduced beyond the current baseline. |  |  |

## 3. Alternatives

- **ALT-001**: Keep the API unbuilt and run TypeScript directly in production with `tsx`. Rejected because production deployables should produce deterministic build artifacts and participate in the monorepo `build` pipeline.
- **ALT-002**: Collapse frontend and backend into a single deployment unit. Rejected because the architecture document explicitly defines separate deployable services and a hybrid communication model.
- **ALT-003**: Proxy all browser API traffic through the frontend service. Rejected because the architecture favors direct browser-to-API calls for interactive flows to avoid an extra hop.

## 4. Dependencies

- **DEP-001**: `typescript` compiler for API emission.
- **DEP-002**: Turborepo task configuration for package-level build outputs.
- **DEP-003**: Existing Fastify runtime configuration in `apps/api/src/lib/config.ts`.
- **DEP-004**: Existing TanStack Start server-only env configuration in `apps/web/src/lib/env/server.ts`.

## 5. Files

- **FILE-001**: `apps/api/package.json` — add production `build` and `start:prod` scripts.
- **FILE-002**: `apps/api/tsconfig.build.json` — dedicated emitting TypeScript config for deployment.
- **FILE-003**: `apps/api/turbo.json` — declare build outputs for Turbo caching.
- **FILE-004**: `apps/web/.env.example` — production browser API URL contract if needed.
- **FILE-005**: `apps/web/src/lib/env/public.ts` — validate any new client-safe API origin variable.
- **FILE-006**: `apps/web/src/lib/env/server.ts` — preserve SSR-only internal API configuration.
- **FILE-007**: `README.md` or `docs/` deployment guidance — document split deployment.

## 6. Testing

- **TEST-001**: Root `pnpm build` runs both `web` and `api` builds successfully.
- **TEST-002**: `pnpm --filter api start:prod` starts the compiled Fastify server successfully.
- **TEST-003**: SSR frontend requests use `INTERNAL_API_URL` in server execution paths.
- **TEST-004**: Browser-origin requests from the deployed web domain pass API CORS validation with credentials enabled.
- **TEST-005**: Existing API inject-based tests continue to pass after introducing the build config.

## 7. Risks & Assumptions

- **RISK-001**: Misconfigured cookie domain or CORS origin will break authenticated browser-to-API flows.
- **RISK-002**: If the frontend browser client keeps using a local-only API base URL contract, production traffic may fail despite successful builds.
- **RISK-003**: Future database and queue integration will likely require a third deployment unit for workers.
- **ASSUMPTION-001**: The selected hosting platform supports separate service configuration for `apps/web` and `apps/api`.
- **ASSUMPTION-002**: The API can run correctly from emitted ESM JavaScript under Node.js 22.

## 8. Related Specifications / Further Reading

- `docs/architecture.md`
- `README.md`
- `.github/instructions/fastify-backend.instructions.md`
- `.github/instructions/tanstack-start.instructions.md`
