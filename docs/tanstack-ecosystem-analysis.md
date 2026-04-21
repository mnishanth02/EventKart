# TanStack Ecosystem Deep Analysis

> **Date:** 2026-04-20
> **Purpose:** Evaluate TanStack as a standardized frontend architecture for Kiran (event-kart)
> **Source:** https://tanstack.com/libraries + GitHub research

---

## Table of Contents

1. [Library Catalog & Maturity Matrix](#1-library-catalog--maturity-matrix)
2. [Individual Library Deep Dive](#2-individual-library-deep-dive)
3. [Composable Architecture Evaluation](#3-composable-architecture-evaluation)
4. [Open-Source Reference Projects](#4-open-source-reference-projects)
5. [Reference Architecture Patterns](#5-reference-architecture-patterns)
6. [Adoption Recommendation](#6-adoption-recommendation)

---

## 1. Library Catalog & Maturity Matrix

| Library | Version | Maturity | Purpose | NPM Downloads | GitHub Stars | Production Ready? |
|---------|---------|----------|---------|---------------|--------------|-------------------|
| **TanStack Query** | v5 | ✅ Stable/GA | Server-state management & data fetching | 3.7B+ | 49,180 | ✅ Yes — battle-tested |
| **TanStack Router** | v1 | ✅ Stable/GA | Type-safe routing for React/Solid | 119M+ (shared repo) | 14,183 | ✅ Yes |
| **TanStack Table** | v8 | ✅ Stable/GA | Headless table/datagrid UI | 1.37B+ | 27,905 | ✅ Yes |
| **TanStack Virtual** | v3 | ✅ Stable/GA | Virtualization for large lists | 1.23B+ | 6,828 | ✅ Yes |
| **TanStack Form** | v1 | ✅ Stable (NEW) | Type-safe form state management | 78.9M+ | 6,478 | ✅ Yes |
| **TanStack Start** | v0 | ⚠️ RC | Full-stack React/Solid framework | (shared with Router) | (shared) | ⚠️ RC — production-viable with pinned deps |
| **TanStack DB** | v0 | 🟡 Beta | Reactive client-first data store | 9.1M+ | 3,723 | ❌ Not yet |
| **TanStack Pacer** | — | 🟡 Beta | Debouncing, throttling, rate limiting | — | — | ❌ Not yet |
| **TanStack Store** | — | 🔴 Alpha | Framework-agnostic reactive store | — | — | ❌ Not yet |
| **TanStack AI** | — | 🔴 Alpha | Multi-provider AI SDK | — | — | ❌ Not yet |
| **TanStack Intent** | — | 🔴 Alpha | Agent Skills for npm packages | — | — | ❌ Not yet |
| **TanStack Hotkeys** | — | 🔴 Alpha | Type-safe keyboard shortcuts | — | — | ❌ Not yet |
| **TanStack Devtools** | — | 🔴 Alpha | Unified devtools panel | — | — | ❌ Not yet |
| **TanStack CLI** | — | 🔴 Alpha | CLI, MCP server, AI toolkit | — | — | ❌ Not yet |
| **TanStack Config** | — | ✅ Stable | JS/TS package publishing tooling | — | — | ✅ (internal tooling) |
| **TanStack Ranger** | — | ✅ Stable | Headless range/slider utilities | — | — | ✅ Niche use |

### Maturity Legend
- ✅ **Stable/GA** — Safe for production, strong community, regular maintenance
- ⚠️ **RC** — Feature-complete, preparing for 1.0, minor breaking changes possible
- 🟡 **Beta** — Core APIs stabilizing, suitable for non-critical features
- 🔴 **Alpha** — Experimental, APIs will change, do not use in production

---

## 2. Individual Library Deep Dive

### TanStack Query (v5) — ✅ ADOPT

**Problem it solves:** Server-state management — fetching, caching, synchronizing, and updating asynchronous data without manual state management boilerplate.

**Key capabilities:**
- Automatic caching with configurable stale-while-revalidate
- Background refetching on window focus, polling, and interval
- Parallel/dependent/paginated/infinite queries
- Optimistic mutations with rollback
- SSR/streaming hydration support
- Dedicated devtools
- Zero dependencies

**Stability:** Rock-solid. Used at Walmart, Airbus, and thousands of production apps. 49K+ stars, 1064 contributors, 761K+ dependents on GitHub.

**Verdict:** The de-facto standard for async state in React. **Replaces:** Redux for server-state, custom fetch logic, SWR (with more features).

---

### TanStack Router (v1) — ✅ ADOPT

**Problem it solves:** Type-safe client-side and full-stack routing with first-class search params, nested layouts, and data loading.

**Key capabilities:**
- 100% inferred TypeScript — navigate calls are fully type-checked
- JSON-first search params with schema validation (replaces URL state hacks)
- Built-in SWR caching for route loaders
- Designed to integrate with external caches (TanStack Query, SWR, Apollo)
- File-based + code-based routing simultaneously
- Route context inheritance (auth, theme, singletons)
- Automatic code splitting
- Route masking, scroll restoration, navigation blocking

**Stability:** v1 GA, actively maintained. 14K+ stars, 710+ contributors.

**Verdict:** Superior DX over React Router for TypeScript projects. Search-params-as-state is a paradigm shift. **Replaces:** React Router, Next.js routing (for SPA/CSR).

---

### TanStack Start (v0 RC) — ⚠️ EVALUATE / ADOPT WITH CAUTION

**Problem it solves:** Full-stack React/Solid framework with SSR, streaming, server functions, and deployment flexibility — without the constraints of Next.js.

**Key capabilities:**
- Full-document SSR + streaming
- Server functions (RPCs) — replaces need for tRPC/GraphQL in many cases
- Client-side first philosophy (doesn't sacrifice SPA DX for server-first)
- Deploy anywhere (Cloudflare, Netlify, Vercel, Node, Railway, etc.)
- Powered by Vite + Nitro
- Server components support
- ISR, static prerendering, selective SSR, SPA mode

**Stability:** RC (Release Candidate). Feature-complete, preparing for 1.0. TanStack.com itself runs on Start. The team recommends pinning dependencies if shipping to production.

**Verdict:** The most compelling Next.js alternative for teams that want client-first DX with full server capabilities. **Replaces:** Next.js, Remix (with better TypeScript integration).

**Risk:** RC status means occasional breaking changes. Lock versions in production.

---

### TanStack Table (v8) — ✅ ADOPT

**Problem it solves:** Headless, framework-agnostic table/datagrid engine with complete feature set.

**Key capabilities:**
- Sorting, filtering (column + global + fuzzy), pagination, grouping
- Row selection, expansion, pinning, DnD
- Column ordering, visibility, resizing, pinning
- Virtualization support (via TanStack Virtual)
- 100% control over markup and styles
- 10-15kb bundle, tree-shakable

**Stability:** Industry standard. 27K+ stars, 457 contributors, 179K+ dependents. Used by shadcn/ui's DataTable.

**Verdict:** Unmatched for data-heavy UIs. **Replaces:** AG Grid (free tier), react-table (it IS react-table v8), MUI DataGrid.

---

### TanStack Form (v1) — ✅ ADOPT

**Problem it solves:** Type-safe, performant form state management without the boilerplate of React Hook Form or Formik.

**Key capabilities:**
- First-class TypeScript with deep generic inference
- Headless — works with any UI library
- Granular reactive updates (only touched fields re-render)
- Async validation with built-in debouncing
- Deeply nested object/array fields
- Framework agnostic (React, Vue, Angular, Solid, Lit, Svelte)
- Plugin/extension architecture
- SSR support with TanStack Start/Next.js

**Stability:** v1 recently released (marked "NEW"). API is stable.

**Verdict:** Modern alternative to React Hook Form with better TypeScript inference. Consider adopting for new forms. **Replaces:** React Hook Form, Formik.

---

### TanStack Virtual (v3) — ✅ ADOPT

**Problem it solves:** Efficiently render massive lists/grids by only mounting visible DOM nodes.

**Key capabilities:**
- Vertical, horizontal, and grid virtualization
- Fixed, variable, and dynamic (measured) sizing
- Window scrolling support
- Sticky items
- 10-15kb, single hook/function API

**Stability:** Mature, 6.8K stars, 363K+ dependents.

**Verdict:** Use for any list > 100 items or large tables. **Replaces:** react-window, react-virtualized.

---

### TanStack DB (v0 Beta) — 🟡 WATCH

**Problem it solves:** Reactive client-first data store with live queries, optimistic mutations, and sync primitives.

**Key capabilities:**
- Collections (typed sets of objects)
- Live queries powered by differential dataflow (sub-millisecond)
- Optimistic mutations with automatic rollback
- Integrations: Electric, PowerSync, RxDB, TanStack Query collections
- Fine-grained reactivity

**Stability:** Beta. 3.7K stars, 0 dependents on GitHub. Still evolving.

**Verdict:** Exciting for real-time/offline-first apps. Not production-ready. Monitor for future adoption when building real-time features.

---

### TanStack Pacer (Beta), Store (Alpha), AI (Alpha), Intent (Alpha), Hotkeys (Alpha), Devtools (Alpha), CLI (Alpha)

**Verdict:** All experimental. Do not adopt for production. Monitor for:
- **Pacer** — Could replace lodash debounce/throttle when stable
- **AI** — Multi-provider AI SDK, interesting for future AI features
- **Devtools** — Will unify debugging experience across TanStack libs

---

## 3. Composable Architecture Evaluation

### The TanStack Philosophy

TanStack promotes a **modular, headless, framework-agnostic** approach:
- Each library solves ONE concern well
- Libraries are designed to compose together but don't require each other
- "Headless" means zero opinions on UI — you own all markup and styling
- TypeScript-first with inference (not just type annotations)

### How Libraries Compose Together

```
┌─────────────────────────────────────────────────────┐
│                  TanStack Start (RC)                 │
│         Full-stack framework / SSR / Deploy          │
├─────────────────────────────────────────────────────┤
│                  TanStack Router (v1)                │
│      Type-safe routing / search params / loaders    │
├──────────────┬──────────────┬───────────────────────┤
│ TanStack     │ TanStack     │ TanStack              │
│ Query (v5)   │ Form (v1)    │ Table (v8)            │
│ Data fetch   │ Form state   │ Data display          │
├──────────────┴──────────────┴───────────────────────┤
│                  TanStack Virtual (v3)              │
│           Performance layer (large lists)            │
├─────────────────────────────────────────────────────┤
│              TanStack DB (Beta - Future)             │
│        Client-first store / real-time sync           │
└─────────────────────────────────────────────────────┘
```

### Integration Patterns

| Combination | Pattern | Benefit |
|-------------|---------|---------|
| Router + Query | Route loaders prefetch via Query's `queryOptions()` | Zero-waterfall data loading with cache |
| Router + Form | Form validation schemas tied to route search params | URL-persisted form state |
| Table + Virtual | TanStack Table rows rendered via Virtual | 60fps tables with 100K+ rows |
| Table + Query | Server-side pagination/filtering via Query | Paginated server data in tables |
| Start + Router + Query | Server functions replace API layer; Query handles client cache | End-to-end type-safe data flow |
| Form + Query | `useMutation` for form submission with optimistic updates | Forms with server sync |

### Key Architectural Benefit

Unlike monolithic frameworks (Next.js), TanStack lets you:
1. **Adopt incrementally** — use Query today, add Router later, consider Start when ready
2. **Replace individually** — swap Form for React Hook Form without touching routing
3. **Stay framework-flexible** — most libraries work in React, Vue, Solid, Svelte, Angular

---

## 4. Open-Source Reference Projects

### Tier 1: High-Quality Production Starters (1000+ stars)

#### 1. BearStudio/start-ui-web (1,722 ⭐)
**Stack:** TanStack Start + Router + Query + React Hook Form + oRPC + Prisma + Better Auth + shadcn/ui + Storybook + Vitest + Playwright

**Why it's notable:**
- Production-used by a consultancy (BearStudio) for real client projects
- Full auth flow, email system, OpenAPI documentation
- E2E testing with Playwright, unit tests with Vitest
- Docker-compose for local dev (PostgreSQL, MinIO, Maildev)
- Oxlint + Oxfmt (modern tooling)
- 49 contributors, actively maintained

**Architecture highlights:**
```
src/
├── components/       # UI components (shadcn-based)
├── emails/          # React Email templates
├── features/        # Feature modules (domain logic)
├── lib/             # Shared utilities
├── routes/          # File-based TanStack routes
└── server/          # oRPC routes + middleware
prisma/              # Schema + migrations
e2e/                 # Playwright tests
```

**Lessons:**
- Feature-based module organization
- oRPC for type-safe API layer (alternative to tRPC)
- Separate email templating concern
- Full testing pyramid (unit + e2e)

---

#### 2. mugnavo/tanstarter (1,119 ⭐)
**Stack:** TanStack Start + Router + Query + Drizzle ORM + Better Auth + shadcn/ui + Vite 8 + Nitro v3

**Why it's notable:**
- Minimal and clean — easy to understand architecture
- React 19 + React Compiler
- Drizzle ORM (lighter than Prisma)
- Deploy-anywhere via Nitro presets
- Also available as monorepo variant (tanstarter-plus with Vite+/pnpm workspaces)
- Active maintenance, oxlint + oxfmt

**Architecture highlights:**
```
src/
├── components/       # UI components
├── lib/
│   ├── auth/        # Better Auth config + middleware
│   ├── db/
│   │   └── schema/  # Drizzle schema files
│   └── utils/       # Shared utilities
├── routes/          # TanStack file-based routes
└── styles/          # Global CSS
```

**Lessons:**
- `lib/` as domain logic container
- Auth middleware pattern for server functions
- Drizzle schema collocated with DB config
- Monorepo variant available (tanstarter-plus)

---

### Tier 2: Specialized Templates (100-500 stars)

#### 3. rs-4/tanstack-ai-demo (312 ⭐)
- AI chat template with multi-model support + real-time streaming
- TanStack Start + shadcn/ui

#### 4. daveyplate/better-auth-tanstack-starter (211 ⭐)
- Focused on auth patterns (Better Auth + PostgreSQL + Drizzle + TanStack Query)

#### 5. Vijayabaskar56/tanstack-start-faster (160 ⭐)
- E-commerce template using TanStack + Cloudflare (performance-focused)
- Inspired by "NextFaster" concept

#### 6. jackytea/tanstack-starter (152 ⭐)
- Clean starter with Drizzle + Better Auth + TanStack

---

### Tier 3: Turborepo + TanStack Monorepos

#### 7. khanhspring/monorepo-ui-starter (6 ⭐)
**Stack:** Turborepo + Vite + TailwindCSS v4 + TanStack Router + Mantine + Storybook

**Architecture:**
```
apps/
├── web/             # Main TanStack Router app
├── docs/            # Documentation app
packages/
├── ui/              # Shared component library
├── config/          # Shared configs (tsconfig, eslint)
└── utils/           # Shared utilities
```

#### 8. makyinmars/mono-f7
**Stack:** Turborepo + Hono + Drizzle + tRPC + TanStack Start + Docker

**Architecture:**
```
apps/
├── web/             # TanStack Start frontend
├── api/             # Hono backend
packages/
├── db/              # Drizzle schema + migrations
├── trpc/            # tRPC router definitions
└── ui/              # Shared components
```

#### 9. mugnavo/tanstarter-plus (97 ⭐)
**Stack:** Vite+ monorepo + TanStack Start + Better Auth + Drizzle + shadcn/ui

---

### Tier 4: Full-Stack Separated Architecture

#### 10. devchaudhary24k/vidcastx (3 ⭐ but comprehensive)
**Stack:** TanStack Start frontend + Elysia (Bun) backend + Drizzle + BullMQ + Redis + AWS

**Architecture pattern:** Frontend and backend as separate services in a monorepo, communicating via type-safe API.

---

## 5. Reference Architecture Patterns

### Pattern A: Full-Stack TanStack Start (Recommended for Kiran V1)

```
project-root/
├── src/
│   ├── routes/              # File-based routing (pages)
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home page
│   │   ├── _authed/         # Auth-required layout group
│   │   │   ├── dashboard/
│   │   │   └── events/
│   │   └── _public/         # Public layout group
│   │       ├── events/
│   │       └── login.tsx
│   ├── features/            # Domain feature modules
│   │   ├── events/
│   │   │   ├── api.ts       # Server functions for events
│   │   │   ├── queries.ts   # TanStack Query options
│   │   │   ├── components/  # Feature-specific components
│   │   │   ├── hooks.ts     # Feature hooks
│   │   │   └── types.ts     # Feature types
│   │   ├── registration/
│   │   ├── payments/
│   │   └── check-in/
│   ├── components/          # Shared UI components (shadcn)
│   │   ├── ui/              # Base UI primitives
│   │   └── shared/          # App-level shared components
│   ├── lib/
│   │   ├── auth/            # Auth config + middleware
│   │   ├── db/              # Drizzle schema + connection
│   │   ├── payments/        # Payment gateway integration
│   │   └── utils/           # Shared utilities
│   └── styles/              # Global styles + Tailwind
├── drizzle/                 # Generated migrations
├── public/                  # Static assets
├── e2e/                     # Playwright E2E tests
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern B: Turborepo + TanStack Frontend + Separate Backend

```
project-root/
├── apps/
│   ├── web/                 # TanStack Start/Router frontend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── features/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── vite.config.ts
│   └── api/                 # Hono/Elysia/Fastify backend
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   └── middleware/
│       └── package.json
├── packages/
│   ├── db/                  # Shared DB schema + client
│   ├── shared/              # Shared types + validators (Zod)
│   ├── ui/                  # Shared component library
│   └── config/              # Shared configs
├── turbo.json
└── pnpm-workspace.yaml
```

### Pattern C: TanStack Router SPA + Existing Backend

```
frontend/
├── src/
│   ├── routes/              # TanStack Router file-based
│   ├── api/                 # API client layer (Query + fetch)
│   ├── features/            # Feature modules
│   ├── components/          # UI components
│   └── lib/                 # Utilities
├── vite.config.ts
└── package.json
```

---

### Best Practices Extracted from Reference Projects

#### 1. Data Layer
- **Use `queryOptions()` factory pattern** — define query options alongside server functions, import in route loaders
- **Collocate server functions with features** — `features/events/api.ts` contains server functions
- **Route loaders for critical data** — non-critical data loaded in components
- **Optimistic mutations** — use `useMutation` with `onMutate` for instant UI updates

#### 2. Routing
- **Pathless layout routes** — `_authed` prefix for authenticated route groups
- **Search params for UI state** — pagination, filters, sort in URL (shareable, bookmarkable)
- **Route context for auth** — pass session/user via `beforeLoad` and context

#### 3. Type Safety
- **End-to-end inference** — from DB schema (Drizzle) → server function → route loader → component
- **Zod/Valibot for validation** — shared between client and server
- **No `any` types** — leverage TanStack's generic propagation

#### 4. Component Architecture
- **Feature-first organization** — not "components/forms/EventForm" but "features/events/components/EventForm"
- **shadcn/ui as base** — copy-paste components you own
- **Headless + styled pattern** — TanStack Table/Form provide logic, you provide UI

#### 5. Auth Pattern (from tanstarter)
```typescript
// lib/auth/middleware.ts
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await auth.api.getSession(/* ... */);
  if (!session) throw redirect({ to: '/login' });
  return next({ context: { session } });
});
```

#### 6. Testing
- **Vitest for unit/integration** — test server functions, utilities, hooks
- **Playwright for E2E** — test full user flows
- **MSW for API mocking** — when testing components in isolation

---

## 5B. Official Documentation Best Practices & Recommendations

> **Sources:** TanStack Start Official Docs + Fastify Official Docs (v5.8.x)
> **Date Researched:** 2026-04-20

---

### TanStack Start — Official Best Practices

#### 1. Server Functions (from Official Docs)

**What they are:** Server functions let you define server-only logic callable from anywhere — loaders, components, hooks, or other server functions. They run on the server but can be invoked from client code seamlessly.

**Best Practices:**

##### File Organization Pattern
```plaintext
src/utils/
├── users.functions.ts   # Server function wrappers (createServerFn)
├── users.server.ts      # Server-only helpers (DB queries, internal logic)
└── schemas.ts           # Shared validation schemas (client-safe)
```

- `.functions.ts` — Export `createServerFn` wrappers, safe to import anywhere
- `.server.ts` — Server-only code, only imported inside server function handlers
- `.ts` (no suffix) — Client-safe code (types, schemas, constants)

##### Static Imports Are Always Safe
```typescript
// ✅ Safe - build process handles environment shaking
import { getUser } from '~/utils/users.functions'

// ❌ Avoid dynamic imports for server functions
const { getUser } = await import('~/utils/users.functions')
```
The build process replaces server function implementations with RPC stubs in client bundles. The actual server code never reaches the browser.

##### Always Validate Input with Zod
```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
})

export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(UserSchema)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    return `Created user: ${data.name}, age ${data.age}`
  })
```

##### Use GET for Read Operations, POST for Mutations
```typescript
// GET request (default) — cacheable, idempotent
export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

// POST request — for mutations
export const saveData = createServerFn({ method: 'POST' }).handler(async () => {
  return { success: true }
})
```

##### Error Handling & Redirects
```typescript
import { createServerFn } from '@tanstack/react-start'
import { redirect, notFound } from '@tanstack/react-router'

// Redirect for auth
export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser()
  if (!user) throw redirect({ to: '/login' })
  return user
})

// Not found for missing resources
export const getPost = createServerFn()
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)
    if (!post) throw notFound()
    return post
  })
```

##### Server Context & Response Caching
```typescript
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders, setResponseStatus } from '@tanstack/react-start/server'

export const getCachedData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeaders(new Headers({
    'Cache-Control': 'public, max-age=300',
    'CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=600',
  }))
  setResponseStatus(200)
  return fetchData()
})
```

---

#### 2. Middleware (from Official Docs)

**Two types:**
| Type | Scope | Methods | Input Validation | Client-side Logic |
|------|-------|---------|-----------------|-------------------|
| Request Middleware | All server requests | `.server()` | No | No |
| Server Function Middleware | Server functions only | `.client()`, `.server()` | Yes (`.inputValidator()`) | Yes |

##### Global Middleware Pattern (src/start.ts)
```typescript
// src/start.ts
import { createStart, createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware().server(async ({ next, request }) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`)
  const result = await next()
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [loggingMiddleware],   // Runs on EVERY request (SSR, routes, server fns)
  functionMiddleware: [authMiddleware],     // Runs on every server function
}))
```

##### Authentication Middleware (Static)
```typescript
import { createMiddleware } from '@tanstack/react-start'

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await auth.getSession({ headers: request.headers })
  if (!session) throw new Error('Unauthorized')
  return await next({ context: { session } })
})
```

##### Authorization Middleware Factory (Dynamic)
```typescript
type Permissions = Record<string, string[]>

export function authorizationMiddleware(permissions: Permissions) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      const granted = await auth.hasPermission(context.session, permissions)
      if (!granted) throw new Error('Forbidden')
      return await next()
    })
}

// Usage per server function:
export const getClients = createServerFn()
  .middleware([authorizationMiddleware({ client: ['read'] })])
  .handler(async ({ context }) => {
    return { message: 'The user can read clients.' }
  })
```

##### Client-Side Middleware (for headers, tokens, telemetry)
```typescript
const authTokenMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    return next({
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  },
)
```

##### Middleware Execution Order
Global middleware runs first (dependency-first), then function-specific middleware:
```
globalMiddleware1 → globalMiddleware2 → middlewareA → middlewareB → serverFn
```

##### Context Flow: Client → Server → Client
```typescript
const serverTimer = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  return next({
    sendContext: { timeFromServer: new Date() },  // Send data back to client
  })
})
```

##### Environment Tree-Shaking
- Server code in `.server()` is **always removed** from client bundles
- Client code in `.client()` is included in client bundles
- Input validation code is also removed from client bundles

---

#### 3. Routing (from Official Docs)

##### Root Route Structure (src/routes/__root.tsx)
```typescript
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Event Kart' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head><HeadContent /></head>
      <body>
        <Outlet />
        <Scripts />  {/* Always include for client-side JS */}
      </body>
    </html>
  )
}
```

##### File-Based Route Conventions
| Path | File | Type |
|------|------|------|
| `/` | `index.tsx` | Index Route |
| `/about` | `about.tsx` | Static Route |
| `/posts` | `posts.tsx` | Layout Route |
| `/posts/` | `posts/index.tsx` | Index Route |
| `/posts/:postId` | `posts/$postId.tsx` | Dynamic Route |
| `/rest/*` | `rest/$.tsx` | Wildcard Route |

##### Nested Routing renders component trees:
```
URL: /posts/123 → <Root><Posts><Post /></Posts></Root>
```

##### Route Types for Organization:
- **Pathless Layout Routes** (`_authed/`) — apply layout without path nesting
- **Non-Nested Routes** — render own component tree independently
- **Grouped Routes** — organize in directory without affecting path hierarchy

---

#### 4. Selective SSR (from Official Docs)

**Three modes per route:**

| Mode | `beforeLoad`/`loader` | Component Rendering |
|------|----------------------|---------------------|
| `ssr: true` (default) | Server on initial, client on navigation | Server-rendered |
| `ssr: 'data-only'` | Server on initial, client on navigation | **Client-rendered** |
| `ssr: false` | Client only | Client only |

##### When to use each:
- **`ssr: true`** — Default for SEO-important pages (event listings, public pages)
- **`ssr: 'data-only'`** — Pages needing server data but with browser-only components (maps, canvas)
- **`ssr: false`** — Admin dashboards, pages using `localStorage`, check-in scanners

##### Dynamic SSR Decision:
```typescript
export const Route = createFileRoute('/docs/$docType/$docId')({
  validateSearch: z.object({ details: z.boolean().optional() }),
  ssr: ({ params, search }) => {
    if (params.status === 'success' && params.value.docType === 'sheet') return false
    if (search.status === 'success' && search.value.details) return 'data-only'
  },
})
```

##### Inheritance Rules:
- Child routes inherit parent SSR config
- Can only become **more restrictive** (true → data-only → false), never less

---

#### 5. Static Prerendering (from Official Docs)

```typescript
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        autoStaticPathsDiscovery: true,  // Auto-discovers static routes
        crawlLinks: true,                // Follows links to prerender linked pages
        concurrency: 14,
        retryCount: 2,
        failOnError: true,
        filter: ({ path }) => !path.startsWith('/admin'),  // Skip admin routes
      },
    }),
  ],
})
```

**Automatic discovery excludes:**
- Routes with path params (`/users/$userId`) — need specific values
- Layout routes (prefixed with `_`)
- Routes without components (API routes)

**Use for Event-Kart:** Prerender public event listing pages, landing pages, marketing pages.

---

#### 6. Performance Recommendations (from Official Docs)

- **Scroll Restoration** — enabled in router config: `scrollRestoration: true`
- **Automatic Code Splitting** — each route is its own chunk by default
- **Route Preloading** — prefetch route data on hover/focus for instant navigation
- **Streaming SSR** — progressive page loading for improved perceived performance
- **CDN Asset URLs** — serve static assets from CDN for global distribution

---

### Fastify — Official Best Practices & Recommendations (v5.8.x)

> **Source:** https://fastify.dev/docs/latest/Guides/Recommendations/
> **Relevance:** If Event-Kart uses a separate API backend (Pattern B architecture) or needs webhooks/payment processing server

---

#### 1. Always Use a Reverse Proxy (CRITICAL)

**The Fastify team strongly considers exposing Node.js directly to the internet an anti-pattern.**

**Why:**
1. Adds unnecessary complexity to the application
2. Prevents horizontal scalability
3. Node.js shouldn't handle TLS termination, static files, or multi-domain routing

**Use Nginx or Caddy in front of Fastify for:**
- TLS termination (HTTPS)
- HTTP → HTTPS redirects
- Static file serving
- Load balancing across multiple instances
- Compression (gzip/brotli)
- Rate limiting at the network level

**Nginx Example (Production):**
```nginx
upstream fastify_app {
  server 10.10.11.1:80;
  server 10.10.11.2:80;
  server 10.10.11.3:80 backup;
}

server {
  listen 443 ssl default_server;
  http2 on;
  ssl_protocols TLSv1.3;
  ssl_prefer_server_ciphers off;
  add_header Strict-Transport-Security "max-age=63072000" always;

  location / {
    proxy_http_version 1.1;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://fastify_app;
  }
}
```

---

#### 2. Performance Optimization (from Official Docs)

##### Response Schema Serialization (2-3x throughput boost)
```typescript
// Define response schemas to speed up JSON serialization
const opts = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          otherValue: { type: 'boolean' }
        }
      }
    }
  }
}

fastify.get('/', opts, async (request, reply) => {
  return { value: 'hello', otherValue: true }
})
```
**Why:** Fastify uses `fast-json-stringify` with response schemas — 2-3x faster than `JSON.stringify`. Also **prevents sensitive data leakage** by only serializing declared fields.

##### Avoid Performance Pitfalls
- **Prefer static or parametric routes over RegExp routes** — RegExp routes are expensive
- **Use route constraints carefully** — version constraints degrade router performance
- **Prefer Fastify plugins/hooks over generic middleware** — native integrations are faster
- **Keep `allErrors: false`** (default) — enabling `allErrors: true` enables DoS attacks on validation
- **Avoid async validation in schemas** — use `preHandler` hooks instead for DB lookups

---

#### 3. Plugin Architecture (from Official Docs)

##### Loading Order (CRITICAL for Fastify)
```
└── plugins (from the Fastify ecosystem)
└── your plugins (your custom plugins)
└── decorators
└── hooks
└── your services
```

##### Encapsulation Model
```typescript
// Registering a plugin creates an isolated scope
fastify.register((instance, opts, done) => {
  instance.decorate('util', (a, b) => a + b)
  // 'util' is ONLY available inside this scope and its children
  done()
})

// Use fastify-plugin to BREAK encapsulation (share with parent)
const fp = require('fastify-plugin')
module.exports = fp(dbPlugin)  // Decorators are now available globally
```

##### When to use `fastify-plugin`:
- Database connections (should be available everywhere)
- Auth utilities (needed across all routes)
- Shared config/settings

##### When NOT to use `fastify-plugin`:
- Route-specific logic
- Feature-specific hooks
- Scoped middleware

---

#### 4. Validation Best Practices (from Official Docs)

##### Always Define Request Schemas
```typescript
const bodyJsonSchema = {
  type: 'object',
  required: ['requiredKey'],
  properties: {
    someKey: { type: 'string' },
    someOtherKey: { type: 'number' },
    requiredKey: { type: 'array', maxItems: 3, items: { type: 'integer' } },
    nullableKey: { type: ['number', 'null'] },
  }
}

const schema = {
  body: bodyJsonSchema,
  querystring: queryStringJsonSchema,
  params: paramsJsonSchema,
  headers: headersJsonSchema
}

fastify.post('/the/url', { schema }, handler)
```

##### Use Shared Schemas for DRY Validation
```typescript
fastify.addSchema({
  $id: 'commonSchema',
  type: 'object',
  properties: { hello: { type: 'string' } }
})

fastify.post('/', {
  schema: {
    body: { $ref: 'commonSchema#' },
    headers: { $ref: 'commonSchema#' }
  }
}, handler)
```

##### Security: Never enable `allErrors: true` on untrusted input
```typescript
// ✅ Default — safe
const fastify = Fastify()  // allErrors: false by default

// ❌ Risky — enables DoS on validation-heavy endpoints
const fastify = Fastify({ ajv: { customOptions: { allErrors: true } } })
```

---

#### 5. Testing (from Official Docs)

##### Separate Application from Server
```typescript
// app.ts — testable application
import Fastify from 'fastify'

export function build(opts = {}) {
  const app = Fastify(opts)
  app.get('/', async () => ({ hello: 'world' }))
  return app
}

// server.ts — production entry point
import { build } from './app'
const server = build({ logger: { level: 'info' } })
server.listen({ port: 3000 })
```

##### Use `fastify.inject()` for Testing (no port needed)
```typescript
import { test } from 'node:test'
import { build } from './app'

test('GET / route', async (t) => {
  const app = build()
  const response = await app.inject({ method: 'GET', url: '/' })
  t.assert.strictEqual(response.statusCode, 200)
  t.assert.deepStrictEqual(response.json(), { hello: 'world' })
})
```

##### Always call `.close()` after tests
```typescript
t.after(() => fastify.close())  // Ensures DB connections are released
```

---

#### 6. Capacity Planning (from Official Docs)

| Goal | vCPU per Instance | Notes |
|------|-------------------|-------|
| **Lowest latency** | 2 vCPU | Second vCPU handles GC + libuv threadpool |
| **Max throughput** | 1 vCPU | Fine for Node.js, lower memory footprint |
| **API gateway** | 0.1-0.2 vCPU | For lightweight proxy/routing workloads |

##### Kubernetes Considerations:
- **Listen on `0.0.0.0`** (not `127.0.0.1`) — readinessProbe uses pod IP
- **Set `trustProxy: true`** when behind a load balancer
- Multiple Fastify instances can run in the same Node.js process safely

---

#### 7. Serverless Deployment (from Official Docs)

**Best platforms for Fastify (handles concurrent requests):**
- Google Cloud Run
- AWS Fargate
- Azure Container Instances
- Vercel (with Fluid Compute)

**Key insight:** Prefer container-based serverless (Cloud Run, Fargate) over function-based (Lambda) to fully leverage Fastify's connection pooling and request pipelining.

**Pattern for dual-mode (local dev + serverless):**
```typescript
function init() {
  const app = fastify()
  app.get('/', (request, reply) => reply.send({ hello: 'world' }))
  return app
}

if (require.main === module) {
  // Local development
  init().listen({ port: 3000 })
} else {
  // Serverless (AWS Lambda, etc.)
  module.exports = init
}
```

---

### Application-Specific Recommendations for Event-Kart

Based on the official documentation, here's what Event-Kart specifically needs:

#### TanStack Start Patterns to Implement

| Feature | Pattern | Why |
|---------|---------|-----|
| Event listings (public) | `ssr: true` + prerendering | SEO, fast initial load |
| Dashboard (private) | `ssr: 'data-only'` | Fetch user data server-side, render client-side |
| Check-in scanner | `ssr: false` | Uses camera/browser APIs |
| Payment processing | Server Functions (POST) + middleware | Security, validation |
| Admin tables | TanStack Table + `ssr: 'data-only'` | Heavy client rendering |
| Event search/filters | Search params in URL | Shareable, bookmarkable |

#### Middleware Stack for Event-Kart
```typescript
// src/start.ts
export const startInstance = createStart(() => ({
  requestMiddleware: [loggingMiddleware, corsMiddleware],
  functionMiddleware: [authMiddleware],
}))

// Feature-specific authorization
const organizerOnly = authorizationMiddleware({ event: ['manage'] })
const attendeeOnly = authorizationMiddleware({ event: ['view', 'register'] })
```

#### Fastify Patterns (if using separate API)

| Concern | Implementation |
|---------|---------------|
| Payment webhooks | Fastify POST route with raw body parsing + HMAC verification |
| File uploads | `@fastify/multipart` with size limits |
| Rate limiting | `@fastify/rate-limit` plugin |
| Security headers | `@fastify/helmet` plugin |
| API documentation | Response schemas (also gives 2-3x serialization speed) |
| Health checks | Dedicated `/health` endpoint on `0.0.0.0` |

#### Performance Checklist

- [ ] Enable `scrollRestoration: true` in router
- [ ] Use `ssr: 'data-only'` for authenticated dashboard routes
- [ ] Prerender public event pages with `crawlLinks: true`
- [ ] Define response schemas on all Fastify API routes
- [ ] Put Nginx/Caddy in front of Node.js in production
- [ ] Use `queryOptions()` factory pattern for all data fetching
- [ ] Set `Cache-Control` headers on read-heavy server functions
- [ ] Never enable `allErrors: true` on public-facing validation

---

## 6. Adoption Recommendation

### ✅ Recommended Stack for Kiran (Event-Kart)

| Layer | Technology | Confidence |
|-------|-----------|------------|
| **Framework** | TanStack Start (RC) | ⚠️ High (pin versions) |
| **Routing** | TanStack Router | ✅ Very High |
| **Data Fetching** | TanStack Query | ✅ Very High |
| **Forms** | TanStack Form | ✅ High |
| **Tables** | TanStack Table | ✅ Very High |
| **Virtualization** | TanStack Virtual | ✅ High (as needed) |
| **UI Components** | shadcn/ui + Tailwind | ✅ Very High |
| **Database** | Drizzle ORM + PostgreSQL | ✅ High |
| **Auth** | Better Auth | ✅ High |
| **Validation** | Zod | ✅ Very High |
| **Testing** | Vitest + Playwright | ✅ Very High |

### ❌ Do NOT Adopt Yet

| Library | Reason |
|---------|--------|
| TanStack DB | Beta — exciting for future real-time features, but not stable |
| TanStack AI | Alpha — wait for stable release |
| TanStack Store | Alpha — use Zustand if you need client state |
| TanStack Pacer | Beta — use lodash/custom for now |
| TanStack Hotkeys | Alpha |

---

### Why TanStack Over Current Alternatives?

| Concern | Next.js | TanStack Start |
|---------|---------|---------------|
| TypeScript DX | Good | **Excellent** — end-to-end inference |
| Client-side experience | Compromised by RSC complexity | **Client-first**, server-capable |
| Routing type safety | Partial (no search params) | **100% type-safe** navigation |
| Data fetching | Framework-coupled | **Modular** (Query is standalone) |
| Vendor lock-in | Vercel-oriented | **Deploy anywhere** |
| Bundle size | Heavier runtime | **Lighter** — tree-shakable |
| Learning curve | RSC/Server Actions confusion | **Clearer** mental model |
| Incremental adoption | All-or-nothing | **Pick what you need** |

### Migration Strategy

1. **Phase 1 (Now):** Adopt TanStack Router + Query for new features
2. **Phase 2 (When 1.0 ships):** Wrap full app in TanStack Start for SSR/server functions
3. **Phase 3 (Future):** Evaluate TanStack DB for real-time event features

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Start is RC, not 1.0 | Pin exact versions; TanStack.com runs on it; active development |
| Smaller ecosystem than Next.js | Core libraries are mature; shadcn/ui works perfectly |
| Learning curve for team | Excellent docs, official course (query.gg), many examples |
| Community size | Growing fast; Discord active; TkDodo (Query maintainer) is responsive |

---

### Final Verdict

**Yes — standardize on TanStack for frontend architecture.**

The combination of TanStack Query (v5) + Router (v1) + Form (v1) + Table (v8) provides a production-ready, type-safe, modular stack that is superior to the alternatives for a TypeScript-first team building a vertical SaaS product like Kiran.

TanStack Start (RC) is the full-stack framework choice if you want SSR and server functions without Next.js's complexity. The RC status is acceptable given that TanStack.com itself runs on it and the team is preparing for 1.0.

The modular nature means you're never locked in — you can replace any individual library without rewriting your entire app. This is the key architectural advantage over monolithic frameworks.

**Use tanstarter (1.1K ⭐) as your starting point and BearStudio/start-ui-web (1.7K ⭐) as your reference architecture.**
