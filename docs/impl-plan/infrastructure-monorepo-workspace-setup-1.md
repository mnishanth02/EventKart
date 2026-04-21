---
goal: "Phase 0.1 — Monorepo & Workspace Setup for Kiran"
version: 1.0
date_created: 2026-04-21
last_updated: 2026-04-21
owner: Engineering / Founding Team
tags: [infrastructure, architecture, monorepo, phase-0]
---

# Introduction

Scaffold `apps/web` (TanStack Start RC), `apps/api` (Fastify v5), `packages/shared`, and `packages/db` into the existing Turborepo v2 monorepo. Replace ESLint + Prettier with Biome, adopt pnpm `catalog:` protocol for centralized dependency versioning, pin pre-1.0 dependencies (Drizzle ORM, TanStack Start), configure TypeScript per-package with correct `moduleResolution` strategies, and add Docker Compose for local development infrastructure.

This plan covers **Phase 0.1 — Monorepo & Tooling Setup** from the high-level implementation plan (`docs/implementation-plan.md`). It produces the workspace skeleton that all subsequent phases build on.

### Current State

- Turborepo v2 monorepo exists with `turbo.json` (uses `tasks` key ✅), `pnpm-workspace.yaml`, root `package.json` (pnpm 9.0.0, turbo ^2.9.6, TS 5.9.2)
- Existing packages: `@repo/eslint-config`, `@repo/typescript-config`, `@repo/ui`
- `apps/` folder is **empty** — both apps need scaffolding from scratch
- TypeScript base config uses `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `target: ES2022`

---

## 1. Requirements & Constraints

### Requirements

- **REQ-001**: Create workspace structure: `apps/web`, `apps/api`, `packages/shared`, `packages/db`, `packages/ui` (existing)
- **REQ-002**: Frontend feature-first module structure: `apps/web/src/features/` with collocated server functions, query options, components, hooks, and types per domain module
- **REQ-003**: Backend modular monolith structure: `apps/api/src/modules/` with routes, service, schemas, types per domain module
- **REQ-004**: pnpm `catalog:` protocol for centralized dependency versioning across all packages
- **REQ-005**: Pin pre-1.0 dependencies — Drizzle ORM 0.45.x (exact), TanStack Start RC (exact)
- **REQ-006**: Configure Biome for linting + formatting (replacing ESLint + Prettier)
- **REQ-007**: Docker Compose for local development (PostgreSQL 17 + Redis 7)
- **REQ-008**: Environment management (local / staging / production) with `.env` files
- **REQ-009**: TypeScript strict mode with correct `moduleResolution` per app type

### Security Requirements

- **SEC-001**: No secrets committed to repository — `.env` files in `.gitignore`, documented in `.env.example`
- **SEC-002**: `trustProxy: true` on Fastify (Railway load balancer requirement)
- **SEC-003**: CORS locked to `https://kiran.app` origin with credentials

### Constraints

- **CON-001**: Fastify v5 only (v4 EOL June 2025)
- **CON-002**: Node.js v24 LTS+ (native TypeScript type stripping is stable — Stability: 2)
- **CON-003**: Drizzle ORM 0.45.x — pin exact version (pre-1.0 with breaking-change risk)
- **CON-004**: TanStack Start RC — pin exact version (pre-1.0 with breaking-change risk)
- **CON-005**: PgBouncer transaction mode requires `prepare: false` in Drizzle config
- **CON-006**: Separate direct DB connection (bypassing PgBouncer) for migrations
- **CON-007**: `verbatimModuleSyntax` MUST NOT be enabled in TanStack Start tsconfig (official docs warn it causes server bundles leaking into client bundles)
- **CON-008**: `verbatimModuleSyntax` MUST be enabled in Fastify tsconfig (required for Node.js native type stripping)
- **CON-009**: No `enum` declarations anywhere — use `as const` objects (enforced by `erasableSyntaxOnly` on backend; best practice on frontend for tree-shaking)
- **CON-010**: Shared Zod schemas in `packages/shared` — imported by both `apps/web` and `apps/api`. Never import from `apps/api` directly.
- **CON-011**: Tailwind v4 (CSS-first config, no `tailwind.config.js`) — integration deferred to Phase 1
- **CON-012**: pnpm 10.x with `catalogMode: strict`

### Patterns

- **PAT-001**: Fastify app factory pattern — `app.ts` exports `buildApp()`, `server.ts` calls `listen()`. Testing uses `app.inject()` without port binding.
- **PAT-002**: Fastify plugin architecture — infrastructure plugins wrapped with `fastify-plugin` (break encapsulation to share globally); domain modules are encapsulated plugins registered under `/api/v1/` prefix.
- **PAT-003**: TanStack Start file-based routing — `src/routes/` directory with `__root.tsx`, layout groups `_public/` (SSR) and `_authed/` (CSR).
- **PAT-004**: Feature-first module convention (frontend) — `features/<domain>/api.ts`, `queries.ts`, `components/`, `hooks.ts`, `types.ts`.
- **PAT-005**: Module convention (backend) — `modules/<domain>/routes.ts`, `service.ts`, `schemas.ts`, `types.ts`.
- **PAT-006**: Just-in-Time Package pattern for `packages/shared` and `packages/db` — export TypeScript directly, consuming apps compile via their own bundler/compiler.
- **PAT-007**: Compiled Package pattern for `apps/api` — Fastify requires `tsc` compilation to `dist/` for production.
- **PAT-008**: Hybrid API client — SSR server functions use `INTERNAL_API_URL` (Railway internal network); browser uses `https://api.kiran.app` (public).
- **PAT-009**: `queryOptions()` factory pattern — define alongside server functions in `features/<domain>/queries.ts`; import in route loaders for zero-waterfall data loading.

### Guidelines

- **GUD-001**: Use `@event-kart/*` namespace for all internal packages (not default `@repo/*`)
- **GUD-002**: Install dependencies where they're used — few deps in root, most in individual packages
- **GUD-003**: One "purpose" per package — `shared` (schemas/types), `db` (Drizzle), `ui` (components)
- **GUD-004**: Use Node.js `imports` (subpath imports) for path aliases instead of TypeScript `compilerOptions.paths`

---

## 2. Implementation Steps

### Phase A: Namespace & Catalog Setup

- GOAL-001: Rename package namespace, enable pnpm catalog protocol, replace ESLint+Prettier with Biome

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Rename `@repo/eslint-config` → `@event-kart/eslint-config` in `packages/eslint-config/package.json` `name` field | | |
| TASK-002 | Rename `@repo/typescript-config` → `@event-kart/typescript-config` in `packages/typescript-config/package.json` `name` field | | |
| TASK-003 | Rename `@repo/ui` → `@event-kart/ui` in `packages/ui/package.json` `name` field. Update `devDependencies` references: `@repo/eslint-config` → `@event-kart/eslint-config`, `@repo/typescript-config` → `@event-kart/typescript-config` | | |
| TASK-004 | Update `packages/ui/tsconfig.json` — verify `extends` resolves to `@event-kart/typescript-config/react-library.json` | | |
| TASK-005 | Add `catalog:` block to `pnpm-workspace.yaml` with all shared dependency versions (see catalog spec below). Add `catalogMode: strict` to settings. | | |
| TASK-006 | Update root `package.json`: set `"packageManager": "pnpm@10.12.1"`, set `"engines": { "node": ">=24" }`, remove `prettier` from `devDependencies`, add `"@biomejs/biome": "^1.9.0"` to `devDependencies`, update scripts: `"lint": "biome check ."`, `"format": "biome format . --write"`, remove `"format": "prettier ..."` | | |
| TASK-007 | Create `biome.json` at repo root with Kiran-specific configuration (see spec below) | | |
| TASK-008 | Delete `packages/eslint-config/` directory entirely (all files: `base.js`, `next.js`, `react-internal.js`, `package.json`, `README.md`) | | |
| TASK-009 | Remove `packages/ui/eslint.config.mjs` (no longer needed — Biome handles linting) | | |
| TASK-010 | Run `pnpm install` to regenerate lockfile with new catalog and namespace | | |

**Catalog spec for `pnpm-workspace.yaml`:**

```yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  # Runtime — React
  react: ^19.2.0
  react-dom: ^19.2.0
  # Runtime — Fastify v5
  fastify: ^5.3.0
  fastify-plugin: ^5.0.0
  "@fastify/cors": ^11.0.0
  "@fastify/rate-limit": ^10.3.0
  "@fastify/cookie": ^11.0.0
  fastify-type-provider-zod: ^4.0.0
  # Runtime — TanStack (pin RC versions)
  "@tanstack/react-start": 1.121.2
  "@tanstack/react-router": 1.121.2
  "@tanstack/react-query": ^5.75.0
  "@tanstack/react-form": ^1.12.0
  "@tanstack/react-table": ^8.21.0
  "@tanstack/react-virtual": ^3.13.0
  # Runtime — Database
  drizzle-orm: 0.45.5
  postgres: ^3.4.5
  # Runtime — Queue & Cache
  bullmq: ^5.52.0
  ioredis: ^5.6.0
  # Runtime — Validation
  zod: ^3.25.0
  # Dev — Build & Tooling
  typescript: 5.9.2
  vite: ^6.3.0
  "@vitejs/plugin-react": ^4.5.0
  drizzle-kit: 0.31.1
  vitest: ^3.2.0
  # Dev — Types
  "@types/node": ^22.15.0
  "@types/react": 19.2.2
  "@types/react-dom": 19.2.2

settings:
  catalogMode: strict
```

**Biome config (`biome.json`):**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "warn",
        "noUnusedVariables": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useTemplate": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".output",
      "*.gen.ts",
      "pnpm-lock.yaml"
    ]
  }
}
```

**Completion criteria:** `pnpm install` succeeds. `pnpm biome check .` runs without config errors. No `@repo/` references remain in any `package.json`.

---

### Phase B: TypeScript Configuration

- GOAL-002: Add TypeScript config variants for TanStack Start (Vite/Bundler) and Fastify (Node.js native TS)

**Depends on:** Phase A (namespace rename must be complete)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create `packages/typescript-config/start.json` for TanStack Start apps (see spec below) | | |
| TASK-012 | Create `packages/typescript-config/fastify.json` for Fastify API + workers (see spec below) | | |
| TASK-013 | Update `packages/typescript-config/package.json` — add `exports` field: `{ "./base.json": "./base.json", "./react-library.json": "./react-library.json", "./start.json": "./start.json", "./fastify.json": "./fastify.json" }` | | |

**`packages/typescript-config/start.json`:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  }
}
```

> **Critical:** `moduleResolution: Bundler` — required for Vite-based TanStack Start.
> **Critical:** Do NOT add `verbatimModuleSyntax` — TanStack Start docs explicitly warn it causes server bundles leaking into client bundles.

**`packages/typescript-config/fastify.json`:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

> `erasableSyntaxOnly: true` + `verbatimModuleSyntax: true` — required for Node.js native type stripping in dev mode (`node --watch src/server.ts`).
> `rewriteRelativeImportExtensions: true` — rewrites `.ts` → `.js` in imports during `tsc` compilation.
> **Constraint:** No `enum` declarations — use `as const` objects instead (enforced by `erasableSyntaxOnly`).

**Completion criteria:** `tsc --showConfig` from both `apps/api` and `apps/web` resolves correct configs without errors.

---

### Phase C: Scaffold `apps/api` — Fastify v5 Backend

- GOAL-003: Create the Fastify v5 backend application with modular monolith structure, app factory pattern, health checks, and skeleton domain modules

**Depends on:** Phase A (catalog + namespace), Phase B (fastify.json tsconfig)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Create `apps/api/package.json` (see spec below) | | |
| TASK-015 | Create `apps/api/tsconfig.json` extending `@event-kart/typescript-config/fastify.json` with `include: ["src"]`, `exclude: ["node_modules", "dist"]` | | |
| TASK-016 | Create `apps/api/src/app.ts` — Fastify app factory with Pino logger, `trustProxy: true`, Zod type provider, plugin registration order (see spec below) | | |
| TASK-017 | Create `apps/api/src/server.ts` — Production entry point: import `buildApp()`, listen on `0.0.0.0:3000`, graceful shutdown on SIGTERM/SIGINT (see spec below) | | |
| TASK-018 | Create `apps/api/src/plugins/cors.ts` — CORS plugin using `@fastify/cors`, origin `['https://kiran.app']`, credentials true, wrapped with `fastify-plugin` | | |
| TASK-019 | Create `apps/api/src/plugins/request-id.ts` — Reuse incoming `X-Request-ID` header or generate UUID v4, wrapped with `fastify-plugin` | | |
| TASK-020 | Create `apps/api/src/plugins/error-handler.ts` — Global `setErrorHandler` mapping `AppError` subclasses to structured JSON responses `{ error, message, statusCode }` | | |
| TASK-021 | Create `apps/api/src/lib/errors.ts` — `AppError` base class (extends `Error`, adds `statusCode: number`, `code: string`), `NotFoundError`, `ConflictError`, `ForbiddenError` subclasses | | |
| TASK-022 | Create `apps/api/src/lib/logger.ts` — Pino logger configuration with JSON output, redaction of sensitive fields | | |
| TASK-023 | Create skeleton module directories with placeholder `routes.ts`, `service.ts`, `schemas.ts`, `types.ts` for: `modules/auth/`, `modules/events/`, `modules/bookings/`, `modules/organizer/`, `modules/check-in/`, `modules/communications/`, `modules/admin/` | | |
| TASK-024 | Create skeleton directories (empty with `.gitkeep`): `src/workers/`, `src/middleware/`, `src/plugins/auth.ts` (placeholder), `src/plugins/rate-limit.ts` (placeholder), `src/plugins/db.ts` (placeholder), `src/lib/redis.ts` (placeholder), `src/lib/queue.ts` (placeholder) | | |
| TASK-025 | Run `pnpm install` from repo root, verify `turbo run check-types --filter=@event-kart/api` passes | | |

**`apps/api/package.json`:**

```json
{
  "name": "@event-kart/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "check-types": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest"
  },
  "dependencies": {
    "@event-kart/db": "workspace:*",
    "@event-kart/shared": "workspace:*",
    "fastify": "catalog:",
    "fastify-plugin": "catalog:",
    "@fastify/cors": "catalog:",
    "@fastify/rate-limit": "catalog:",
    "@fastify/cookie": "catalog:",
    "fastify-type-provider-zod": "catalog:",
    "zod": "catalog:",
    "ioredis": "catalog:",
    "bullmq": "catalog:",
    "drizzle-orm": "catalog:",
    "postgres": "catalog:"
  },
  "devDependencies": {
    "@event-kart/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "@types/node": "catalog:",
    "vitest": "catalog:"
  }
}
```

**`apps/api/src/app.ts` (skeleton):**

```typescript
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import corsPlugin from './plugins/cors.js'
import requestIdPlugin from './plugins/request-id.js'
import errorHandlerPlugin from './plugins/error-handler.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    trustProxy: true,
  })

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Infrastructure plugins (order matters)
  await app.register(requestIdPlugin)
  await app.register(corsPlugin)
  await app.register(errorHandlerPlugin)

  // TODO: Phase 0.3 — register db plugin
  // TODO: Phase 0.4 — register auth, rate-limit plugins

  // Health check routes
  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/ready', async () => {
    // TODO: Phase 0.3 — add DB ping + Redis ping
    return { status: 'ok' }
  })

  // Domain modules registered under /api/v1/ prefix
  // TODO: Phase 2+ — register domain modules
  // await app.register(authRoutes, { prefix: '/api/v1/auth' })
  // await app.register(eventRoutes, { prefix: '/api/v1/events' })

  return app
}
```

**`apps/api/src/server.ts` (skeleton):**

```typescript
import { buildApp } from './app.js'

const app = await buildApp()

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down gracefully...')
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

**Completion criteria:** `node --watch apps/api/src/server.ts` starts without errors. `GET http://localhost:3000/health` returns `{ "status": "ok" }`. `tsc --noEmit` from `apps/api/` passes.

---

### Phase D: Scaffold `apps/web` — TanStack Start Frontend

- GOAL-004: Create the TanStack Start frontend application with feature-first module structure, Vite config, router, root layout, and hybrid API client

**Depends on:** Phase A (catalog + namespace), Phase B (start.json tsconfig)
**Can run in parallel with:** Phase C

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Create `apps/web/package.json` (see spec below) | | |
| TASK-027 | Create `apps/web/tsconfig.json` extending `@event-kart/typescript-config/start.json` with `include: ["src"]` | | |
| TASK-028 | Create `apps/web/vite.config.ts` — `tanstackStart()` plugin BEFORE `viteReact()`, port 3001, `tsconfigPaths: true` (see spec below) | | |
| TASK-029 | Create `apps/web/src/router.tsx` — `createRouter({ routeTree, scrollRestoration: true })` with TanStack Query default `staleTime: 30_000` | | |
| TASK-030 | Create `apps/web/src/routes/__root.tsx` — HTML shell with `<HeadContent />`, `<Scripts />`, charset/viewport meta tags, Kiran title (see spec below) | | |
| TASK-031 | Create `apps/web/src/routes/index.tsx` — Placeholder homepage: `createFileRoute('/')`, renders `<h1>Kiran</h1>` | | |
| TASK-032 | Create `apps/web/src/routes/_public/route.tsx` — Public layout wrapper (SSR group), renders `<Outlet />` | | |
| TASK-033 | Create `apps/web/src/routes/_authed/route.tsx` — Authenticated layout wrapper (CSR group), renders `<Outlet />` with auth check placeholder | | |
| TASK-034 | Create `apps/web/src/lib/api-client.ts` — Hybrid fetch wrapper: `INTERNAL_API_URL` on server, `VITE_API_URL` in browser (see spec below) | | |
| TASK-035 | Create feature module directories with placeholder files (`api.ts`, `queries.ts`, `types.ts`, `components/.gitkeep`, `hooks.ts`) for: `features/events/`, `features/registration/`, `features/payments/`, `features/check-in/`, `features/organizer/`, `features/admin/` | | |
| TASK-036 | Create empty directories: `src/components/.gitkeep`, `src/lib/auth/.gitkeep`, `src/lib/utils/.gitkeep`, `src/styles/app.css` (with `@import "tailwindcss"` placeholder comment) | | |
| TASK-037 | Create `apps/web/public/.gitkeep` | | |
| TASK-038 | Run `pnpm install` from repo root, verify `turbo run check-types --filter=@event-kart/web` passes | | |

**`apps/web/package.json`:**

```json
{
  "name": "@event-kart/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "check-types": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": {
    "@event-kart/shared": "workspace:*",
    "@event-kart/ui": "workspace:*",
    "react": "catalog:",
    "react-dom": "catalog:",
    "@tanstack/react-start": "catalog:",
    "@tanstack/react-router": "catalog:",
    "@tanstack/react-query": "catalog:",
    "@tanstack/react-form": "catalog:",
    "@tanstack/react-table": "catalog:",
    "@tanstack/react-virtual": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@event-kart/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "vite": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:"
  }
}
```

**`apps/web/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3001,
  },
  plugins: [
    tanstackStart(),
    // React's Vite plugin MUST come after TanStack Start's plugin
    viteReact(),
  ],
})
```

**`apps/web/src/routes/__root.tsx` (skeleton):**

```tsx
/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kiran — Fitness Events in India' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

**`apps/web/src/lib/api-client.ts`:**

```typescript
const API_BASE =
  typeof window === 'undefined'
    ? process.env.INTERNAL_API_URL ?? 'http://localhost:3000'
    : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

export async function apiClient<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `API error: ${res.status}`)
  }

  return res.json() as Promise<T>
}
```

**Completion criteria:** `vite dev` starts from `apps/web/` without errors. `GET http://localhost:3001` renders the Kiran placeholder. `tsc --noEmit` from `apps/web/` passes.

---

### Phase E: Scaffold Shared Packages

- GOAL-005: Create `packages/shared` (Zod schemas, types, constants, utils) and `packages/db` (Drizzle ORM setup) as Just-in-Time Packages

**Depends on:** Phase A (catalog + namespace)
**Can run in parallel with:** Phases C and D

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-039 | Create `packages/shared/package.json` with Just-in-Time Package exports (see spec below) | | |
| TASK-040 | Create `packages/shared/tsconfig.json` extending `@event-kart/typescript-config/base.json` with `include: ["src"]`, `noEmit: true` | | |
| TASK-041 | Create `packages/shared/src/schemas/index.ts` — export placeholder Zod schema and `UserRole` const enum | | |
| TASK-042 | Create `packages/shared/src/types/index.ts` — export placeholder `ApiResponse<T>` type, `UserRole` type | | |
| TASK-043 | Create `packages/shared/src/constants/index.ts` — export `USER_ROLES`, `BOOKING_STATUSES`, `EVENT_STATUSES` as `as const` objects | | |
| TASK-044 | Create `packages/shared/src/utils/index.ts` — export `formatINR()` (Indian rupee formatting), `generateSlug()` placeholder | | |
| TASK-045 | Create `packages/db/package.json` with Just-in-Time Package exports (see spec below) | | |
| TASK-046 | Create `packages/db/tsconfig.json` extending `@event-kart/typescript-config/base.json` with `include: ["src"]`, `noEmit: true` | | |
| TASK-047 | Create `packages/db/src/index.ts` — Drizzle client factory with `prepare: false` for PgBouncer, separate `DATABASE_DIRECT_URL` for migrations | | |
| TASK-048 | Create `packages/db/src/schema/index.ts` — placeholder empty schema barrel export | | |
| TASK-049 | Create `packages/db/src/migrations/.gitkeep` — empty migrations directory | | |
| TASK-050 | Create `packages/db/drizzle.config.ts` — Drizzle Kit config using `DATABASE_DIRECT_URL` for migrations | | |
| TASK-051 | Update `packages/ui/package.json` — convert version ranges to `catalog:` for `react`, `react-dom`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`. Remove `@event-kart/eslint-config` from devDependencies. Remove `eslint` from devDependencies. Update `scripts.lint` to `biome check .` | | |
| TASK-052 | Run `pnpm install`, verify `turbo run check-types` passes for all packages | | |

**`packages/shared/package.json`:**

```json
{
  "name": "@event-kart/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./schemas": "./src/schemas/index.ts",
    "./types": "./src/types/index.ts",
    "./constants": "./src/constants/index.ts",
    "./utils": "./src/utils/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@event-kart/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**`packages/db/package.json`:**

```json
{
  "name": "@event-kart/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "lint": "biome check .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "catalog:",
    "postgres": "catalog:"
  },
  "devDependencies": {
    "@event-kart/typescript-config": "workspace:*",
    "drizzle-kit": "catalog:",
    "typescript": "catalog:",
    "@types/node": "catalog:"
  }
}
```

**`packages/db/src/index.ts` (skeleton):**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(connectionString, {
  prepare: false, // MANDATORY — PgBouncer transaction mode
})

export const db = drizzle(client, { schema })
export type Database = typeof db
```

**`packages/db/drizzle.config.ts`:**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use direct connection for migrations (bypass PgBouncer)
    url: process.env.DATABASE_DIRECT_URL!,
  },
})
```

**`packages/shared/src/constants/index.ts` (skeleton):**

```typescript
export const USER_ROLES = {
  PUBLIC: 'public',
  PARTICIPANT: 'participant',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const EVENT_STATUSES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const

export type EventStatus = (typeof EVENT_STATUSES)[keyof typeof EVENT_STATUSES]

export const BOOKING_STATUSES = {
  RESERVED: 'reserved',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHECKED_IN: 'checked_in',
} as const

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]
```

**Completion criteria:** `turbo run check-types` passes for `@event-kart/shared`, `@event-kart/db`, and `@event-kart/ui`. Import `@event-kart/shared/constants` resolves correctly from `apps/api` and `apps/web`.

---

### Phase F: Turbo Configuration, Docker & Environment

- GOAL-006: Update Turborepo task configuration, create Docker Compose for local dev, and set up environment variable management

**Depends on:** Phases A–E (all packages must exist for graph validation)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-053 | Update `turbo.json` — replace existing config with Kiran-specific tasks (see spec below) | | |
| TASK-054 | Update root `package.json` scripts — add `"test": "turbo run test"`, `"db:migrate": "turbo run db:migrate --filter=@event-kart/db"`, `"db:generate": "turbo run db:generate --filter=@event-kart/db"` | | |
| TASK-055 | Create `docker-compose.yml` at repo root (see spec below) | | |
| TASK-056 | Create `.env.example` at repo root with all documented env vars (see spec below) | | |
| TASK-057 | Create `apps/api/.env.example` with API-specific env vars | | |
| TASK-058 | Create `apps/web/.env.example` with web-specific env vars (VITE_ prefixed for client exposure) | | |
| TASK-059 | Verify `.gitignore` includes `.env`, `.env.local`, `.env.*.local`, `dist/`, `.output/` | | |
| TASK-060 | Create `.editorconfig` at repo root for IDE consistency | | |
| TASK-061 | Run full verification: `pnpm install && turbo run build && turbo run check-types && turbo run lint` | | |

**`turbo.json` (replacement):**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "DATABASE_DIRECT_URL",
    "REDIS_URL",
    "INTERNAL_API_URL",
    "SESSION_SECRET"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".output/**"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

**`docker-compose.yml`:**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: kiran-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: kiran_dev
      POSTGRES_USER: kiran
      POSTGRES_PASSWORD: kiran_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kiran -d kiran_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: kiran-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

**`.env.example` (root):**

```bash
# ─── Database ────────────────────────────────────────
# PgBouncer URL (app connections — prepare: false enforced)
DATABASE_URL=postgresql://kiran:kiran_dev@localhost:5432/kiran_dev
# Direct connection (migrations only — bypasses PgBouncer)
DATABASE_DIRECT_URL=postgresql://kiran:kiran_dev@localhost:5432/kiran_dev

# ─── Redis ───────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── API ─────────────────────────────────────────────
# Internal URL for TanStack Start SSR → Fastify (Railway internal network in prod)
INTERNAL_API_URL=http://localhost:3000

# ─── Auth ────────────────────────────────────────────
SESSION_SECRET=change-me-in-production

# ─── External Services (Phase 2+) ───────────────────
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# RAZORPAY_WEBHOOK_SECRET=
# MSG91_AUTH_KEY=
# RESEND_API_KEY=
```

**`apps/api/.env.example`:**

```bash
# Fastify API — local development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
NODE_ENV=development
DATABASE_URL=postgresql://kiran:kiran_dev@localhost:5432/kiran_dev
DATABASE_DIRECT_URL=postgresql://kiran:kiran_dev@localhost:5432/kiran_dev
REDIS_URL=redis://localhost:6379
SESSION_SECRET=dev-session-secret
```

**`apps/web/.env.example`:**

```bash
# TanStack Start — local development
PORT=3001
NODE_ENV=development
# Server-side only (not exposed to browser)
INTERNAL_API_URL=http://localhost:3000
# Client-side (exposed via Vite — must be VITE_ prefixed)
VITE_API_URL=http://localhost:3000
```

**`.editorconfig`:**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

**Completion criteria:**
1. `pnpm install` succeeds with `catalog:` resolving all versions
2. `turbo run build` completes — Fastify compiles to `dist/`, TanStack Start builds to `.output/`
3. `turbo run check-types` passes for all packages (zero TS errors)
4. `turbo run lint` (Biome) passes with zero errors
5. `turbo run dev` starts web on :3001 and api on :3000 simultaneously
6. `docker compose up -d` starts PostgreSQL 17 + Redis 7, both pass health checks
7. `GET http://localhost:3000/health` returns `{ "status": "ok" }` from Fastify
8. `GET http://localhost:3001` renders TanStack Start placeholder page with "Kiran" heading
9. `turbo run build --graph` shows correct dependency edges: `shared` → `db` → `api`, `shared` → `ui` → `web`
10. No `@repo/` references remain anywhere in the codebase
11. No `enum` declarations in any `.ts` file

---

## 3. Alternatives

- **ALT-001**: Keep ESLint + Prettier instead of Biome — rejected because implementation plan explicitly calls for Biome as single tool; ESLint config has Next.js deps we won't use; Biome is faster and reduces config surface.
- **ALT-002**: Use `@repo/*` namespace — rejected because implementation plan and all architecture docs reference `@event-kart/shared`. Renaming early avoids churn later.
- **ALT-003**: Use `tsx` for Fastify dev mode — rejected in favor of Node.js native type stripping (stable since Node 23.6+, current LTS v24.15). Zero extra dependencies, native `--watch` support. Production still compiles with `tsc`.
- **ALT-004**: Use `tsc --watch + nodemon` for Fastify dev — rejected; more complex, slower feedback loop vs native `node --watch`.
- **ALT-005**: Use pnpm 9.5+ (minimal upgrade) — rejected in favor of pnpm 10.x for `catalogMode: strict` enforcement and latest features.
- **ALT-006**: Compiled Package pattern for `packages/shared` and `packages/db` — rejected in favor of Just-in-Time Package pattern. Internal packages don't need a build step; consuming apps compile them via their own bundler/compiler. Per Turborepo docs, this is simplest for internal packages.
- **ALT-007**: Use `moduleResolution: NodeNext` for TanStack Start — rejected because TanStack Start uses Vite which requires `moduleResolution: Bundler`.
- **ALT-008**: Enable `verbatimModuleSyntax` in TanStack Start — rejected per official TanStack Start docs which explicitly warn it causes server bundles leaking into client bundles.
- **ALT-009**: Containerize Node.js apps in Docker Compose — rejected for dev mode; native execution provides faster HMR/hot-reload. Docker Compose only runs infrastructure (Postgres + Redis).

---

## 4. Dependencies

### External Dependencies (via pnpm catalog)

- **DEP-001**: `fastify@^5.3.0` — HTTP framework for backend API
- **DEP-002**: `@tanstack/react-start@1.121.2` — Full-stack React framework (pinned RC)
- **DEP-003**: `@tanstack/react-router@1.121.2` — Type-safe file-based router (pinned RC)
- **DEP-004**: `@tanstack/react-query@^5.75.0` — Server state management
- **DEP-005**: `react@^19.2.0` + `react-dom@^19.2.0` — React 19
- **DEP-006**: `drizzle-orm@0.45.5` — ORM (pinned pre-1.0)
- **DEP-007**: `zod@^3.25.0` — Runtime validation (shared FE ↔ BE)
- **DEP-008**: `vite@^6.3.0` — Build tool for TanStack Start
- **DEP-009**: `typescript@5.9.2` — TypeScript compiler
- **DEP-010**: `@biomejs/biome@^1.9.0` — Linting + formatting
- **DEP-011**: `bullmq@^5.52.0` — Job queue for async processing
- **DEP-012**: `ioredis@^5.6.0` — Redis client
- **DEP-013**: `postgres@^3.4.5` — PostgreSQL driver for Drizzle

### Infrastructure Dependencies

- **DEP-014**: PostgreSQL 17 (Docker, Railway in prod)
- **DEP-015**: Redis 7 (Docker, Railway in prod)
- **DEP-016**: Node.js v24 LTS (native TS type stripping)
- **DEP-017**: pnpm 10.x (catalog: protocol with strict mode)

### Internal Package Dependencies

- **DEP-018**: `@event-kart/shared` — consumed by `apps/api`, `apps/web`
- **DEP-019**: `@event-kart/db` — consumed by `apps/api`
- **DEP-020**: `@event-kart/ui` — consumed by `apps/web`
- **DEP-021**: `@event-kart/typescript-config` — consumed by all packages

---

## 5. Files

### Files to DELETE

- **FILE-001**: `packages/eslint-config/base.js` — replaced by Biome
- **FILE-002**: `packages/eslint-config/next.js` — replaced by Biome (no Next.js in project)
- **FILE-003**: `packages/eslint-config/react-internal.js` — replaced by Biome
- **FILE-004**: `packages/eslint-config/package.json` — package removed
- **FILE-005**: `packages/eslint-config/README.md` — package removed
- **FILE-006**: `packages/ui/eslint.config.mjs` — replaced by Biome

### Files to MODIFY

- **FILE-007**: `pnpm-workspace.yaml` — add `catalog:` block + `settings.catalogMode: strict`
- **FILE-008**: `turbo.json` — replace tasks, outputs, add `globalEnv`
- **FILE-009**: `package.json` (root) — update scripts, deps, engines, packageManager
- **FILE-010**: `packages/typescript-config/package.json` — rename namespace, add `exports`
- **FILE-011**: `packages/ui/package.json` — rename namespace, convert to `catalog:`, remove eslint deps

### Files to CREATE

- **FILE-012**: `biome.json` — repo-wide Biome configuration
- **FILE-013**: `.editorconfig` — IDE consistency
- **FILE-014**: `docker-compose.yml` — local dev infrastructure
- **FILE-015**: `.env.example` — documented root env vars
- **FILE-016**: `apps/api/.env.example` — API env vars
- **FILE-017**: `apps/web/.env.example` — web env vars
- **FILE-018**: `packages/typescript-config/start.json` — TanStack Start tsconfig
- **FILE-019**: `packages/typescript-config/fastify.json` — Fastify tsconfig
- **FILE-020**: `apps/api/package.json`
- **FILE-021**: `apps/api/tsconfig.json`
- **FILE-022**: `apps/api/src/server.ts`
- **FILE-023**: `apps/api/src/app.ts`
- **FILE-024**: `apps/api/src/plugins/cors.ts`
- **FILE-025**: `apps/api/src/plugins/request-id.ts`
- **FILE-026**: `apps/api/src/plugins/error-handler.ts`
- **FILE-027**: `apps/api/src/lib/errors.ts`
- **FILE-028**: `apps/api/src/lib/logger.ts`
- **FILE-029**: `apps/api/src/modules/auth/routes.ts` (+ service.ts, schemas.ts, types.ts)
- **FILE-030**: `apps/api/src/modules/events/routes.ts` (+ service.ts, schemas.ts, types.ts)
- **FILE-031**: `apps/api/src/modules/bookings/` (skeleton)
- **FILE-032**: `apps/api/src/modules/organizer/` (skeleton)
- **FILE-033**: `apps/api/src/modules/check-in/` (skeleton)
- **FILE-034**: `apps/api/src/modules/communications/` (skeleton)
- **FILE-035**: `apps/api/src/modules/admin/` (skeleton)
- **FILE-036**: `apps/web/package.json`
- **FILE-037**: `apps/web/tsconfig.json`
- **FILE-038**: `apps/web/vite.config.ts`
- **FILE-039**: `apps/web/src/router.tsx`
- **FILE-040**: `apps/web/src/routes/__root.tsx`
- **FILE-041**: `apps/web/src/routes/index.tsx`
- **FILE-042**: `apps/web/src/routes/_public/route.tsx`
- **FILE-043**: `apps/web/src/routes/_authed/route.tsx`
- **FILE-044**: `apps/web/src/lib/api-client.ts`
- **FILE-045**: `apps/web/src/features/events/` (skeleton)
- **FILE-046**: `apps/web/src/features/registration/` (skeleton)
- **FILE-047**: `apps/web/src/features/payments/` (skeleton)
- **FILE-048**: `apps/web/src/features/check-in/` (skeleton)
- **FILE-049**: `apps/web/src/features/organizer/` (skeleton)
- **FILE-050**: `apps/web/src/features/admin/` (skeleton)
- **FILE-051**: `packages/shared/package.json`
- **FILE-052**: `packages/shared/tsconfig.json`
- **FILE-053**: `packages/shared/src/schemas/index.ts`
- **FILE-054**: `packages/shared/src/types/index.ts`
- **FILE-055**: `packages/shared/src/constants/index.ts`
- **FILE-056**: `packages/shared/src/utils/index.ts`
- **FILE-057**: `packages/db/package.json`
- **FILE-058**: `packages/db/tsconfig.json`
- **FILE-059**: `packages/db/drizzle.config.ts`
- **FILE-060**: `packages/db/src/index.ts`
- **FILE-061**: `packages/db/src/schema/index.ts`

---

## 6. Testing

- **TEST-001**: `pnpm install` completes without errors and `catalog:` versions resolve correctly in `pnpm-lock.yaml`
- **TEST-002**: `turbo run check-types` exits 0 for all packages (zero TypeScript errors)
- **TEST-003**: `turbo run lint` (Biome) exits 0 for all packages
- **TEST-004**: `turbo run build` succeeds — `apps/api/dist/server.js` exists, `apps/web/.output/` exists
- **TEST-005**: `turbo run dev` starts both apps — API responds on :3000, web responds on :3001
- **TEST-006**: `GET http://localhost:3000/health` returns `{ "status": "ok" }` with 200
- **TEST-007**: `GET http://localhost:3001` returns HTML containing "Kiran"
- **TEST-008**: `docker compose up -d` starts postgres + redis, `docker compose ps` shows both healthy
- **TEST-009**: `turbo run build --graph` shows correct package dependency edges
- **TEST-010**: `grep -r "@repo/" packages/ apps/` returns zero results (no stale namespace references)
- **TEST-011**: `grep -rn "^[[:space:]]*enum " apps/ packages/` returns zero results (no enum declarations)
- **TEST-012**: `node apps/api/src/server.ts` starts successfully using native type stripping (no build step needed for dev)

---

## 7. Risks & Assumptions

### Risks

- **RISK-001**: TanStack Start RC may introduce breaking changes before v1. **Mitigation:** Pin exact version (1.121.2), validate before any upgrade, monitor release notes.
- **RISK-002**: Drizzle ORM 0.45.x is pre-1.0 with potential breaking changes. **Mitigation:** Pin exact version (0.45.5), run migration tests in CI before upgrading.
- **RISK-003**: Node.js native type stripping has limitations — no `enum`, no `namespace` with runtime code, no parameter properties. **Mitigation:** `erasableSyntaxOnly: true` in tsconfig enforces this at compile time. Use `as const` objects instead of enums.
- **RISK-004**: pnpm `catalog:` with `strict` mode may cause friction when adding new dependencies not yet in catalog. **Mitigation:** Document the workflow for adding new catalog entries in contributing guide.
- **RISK-005**: Biome may not cover all ESLint rules used by the team. **Mitigation:** Biome covers recommended TypeScript + React rules which exceeds our needs. Monitor Biome releases for additional rule coverage.

### Assumptions

- **ASSUMPTION-001**: Node.js v24 LTS is installed on all development machines and CI runners.
- **ASSUMPTION-002**: Docker Desktop (or equivalent) is installed for local PostgreSQL + Redis.
- **ASSUMPTION-003**: pnpm 10.x is installed globally or managed via `corepack enable`.
- **ASSUMPTION-004**: Railway deployment infrastructure is available for staging (not covered by this plan — see Phase 0.2).
- **ASSUMPTION-005**: The TanStack Start RC API (`tanstackStart()` Vite plugin, `createFileRoute`, `createRootRoute`, `HeadContent`, `Scripts`) is stable and matches current docs.
- **ASSUMPTION-006**: Fastify v5 + `fastify-type-provider-zod` work together correctly (confirmed by Fastify official docs listing it as compatible type provider).

---

## 8. Related Specifications / Further Reading

- [docs/implementation-plan.md](../implementation-plan.md) — High-level implementation plan (Phase 0.1 scope)
- [docs/architecture.md](../architecture.md) — System architecture and tech stack decisions
- [docs/requirements.md](../requirements.md) — Product requirements
- [.github/instructions/fastify-backend.instructions.md](../../.github/instructions/fastify-backend.instructions.md) — Kiran backend project-specific patterns
- [.github/instructions/tanstack-start.instructions.md](../../.github/instructions/tanstack-start.instructions.md) — Kiran frontend project-specific patterns
- [TanStack Start — Build from Scratch](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) — Official setup guide
- [Fastify v5 — Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/) — Official Fastify setup
- [Turborepo — Structuring a Repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) — Monorepo structure guide
- [Turborepo — Creating an Internal Package](https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package) — Internal package patterns
- [pnpm Catalogs](https://pnpm.io/catalogs) — Catalog protocol documentation
- [Node.js — TypeScript Type Stripping](https://nodejs.org/docs/latest/api/typescript.html) — Native TS support (Stability: 2)
