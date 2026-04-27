---
description: "Use when editing EventKart TanStack Start frontend files under apps/web. Covers routes, SSR modes, API communication, data loading, forms, and UI conventions."
applyTo: "**/apps/web/**/*.{ts,tsx}"
---

# EventKart Frontend — Project-Specific Patterns

> For generic TanStack Start patterns (server functions, middleware, SSR, prerendering), see the installed skill: `.agents/skills/tanstack-start-best-practices/`
> This file contains ONLY EventKart-specific decisions, module structure, and domain patterns.

---

## Project Structure (EventKart-Specific)

```
apps/web/src/
├── routes/
│   ├── __root.tsx
│   ├── _public/            # SSR layout: /, /events/*, /organizers/*
│   └── _authed/            # CSR layout: /book/*, /my/*, /org/*, /admin/*
├── features/               # Feature-first modules (NOT layer-first)
│   ├── events/             # api.ts, queries.ts, components/, hooks.ts, types.ts
│   ├── registration/
│   ├── payments/
│   ├── check-in/
│   ├── organizer/
│   └── admin/
├── components/             # Shared shadcn/ui components
├── lib/
│   ├── auth/               # Auth middleware + helpers
│   └── utils/
└── styles/
```

### Feature Module Convention

```
features/<domain>/
├── api.ts              # createServerFn wrappers (safe to import anywhere)
├── api.server.ts       # Server-only helpers — NEVER import from client code
├── queries.ts          # queryOptions() factories for route loaders + components
├── components/         # Feature-specific React components
├── hooks.ts
└── types.ts            # Client-safe types
```

---

## SSR Decisions (EventKart Routes)

| Route               | SSR Mode           | Reason                                                  |
| ------------------- | ------------------ | ------------------------------------------------------- |
| `/` (discovery)     | `ssr: true`        | SEO, CDN-cacheable                                      |
| `/events/:slug`     | `ssr: true`        | SEO, OG tags, CDN `s-maxage` + `stale-while-revalidate` |
| `/organizers/:slug` | `ssr: true`        | SEO                                                     |
| `/book/:eventId`    | `ssr: 'data-only'` | Server data needed, Razorpay SDK renders client-side    |
| `/my/*`             | `ssr: 'data-only'` | Auth data from server, CSR dashboard                    |
| `/org/*`            | `ssr: 'data-only'` | Auth data from server, CSR dashboard                    |
| `/admin/*`          | `ssr: 'data-only'` | Auth data from server, CSR admin                        |
| `/org/check-in`     | `ssr: false`       | Uses camera/QR browser APIs                             |

---

## Authorization — EventKart Roles

```typescript
// lib/auth/middleware.ts
export function requireRole(role: "organizer" | "admin") {
  return createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (context.session.role !== role) throw new Error("Forbidden");
      return next();
    });
}

const organizerOnly = requireRole("organizer");
const adminOnly = requireRole("admin");
```

---

## Hybrid API Communication (EventKart Architecture)

The frontend communicates with Fastify (`api.eventkart.app`) using two paths:

| Context              | Target                                                | Auth                      |
| -------------------- | ----------------------------------------------------- | ------------------------- |
| SSR server functions | `INTERNAL_API_URL` (Railway internal network, ~1–5ms) | Forward incoming cookie   |
| Browser (CSR pages)  | `https://api.eventkart.app` (public)                  | Cookie sent automatically |

```typescript
// lib/api-client.ts
const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL // http://api.railway.internal:3000
    : "https://api.eventkart.app";

export async function apiClient(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    credentials: "include",
  });
}
```

---

## Data Fetching — EventKart Conventions

- `queryOptions()` factories in `features/<domain>/queries.ts`
- Route loaders use `ensureQueryData` (fetches if stale) — NOT `fetchQuery`
- Default `staleTime: 30_000` (30s), `gcTime: 300_000` (5min)
- Use `invalidateQueries` after mutations

```typescript
// features/events/queries.ts
export const eventQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["events", slug],
    queryFn: () => getEvent({ data: { slug } }),
    staleTime: 30_000,
  });
```

---

## Domain-Specific Patterns

### Registration Form (TanStack Form + Zod from shared)

- Schemas from `@eventkart/shared/schemas` — same schema validates on frontend and Fastify
- Use `zodValidator()` adapter with `@tanstack/react-form`
- Async validation for phone uniqueness (debounced)

### Participant Tables (Table + Virtual)

- Organizer roster: server-side pagination for >100 rows
- Use TanStack Virtual when rendering 20K+ participant rows
- Use shadcn/ui DataTable wrapper

### Event Search/Filters (URL State)

- Pagination, category, sort stored in search params (shareable, bookmarkable)
- Validate with Zod schema in `validateSearch`

---

## Caching — EventKart CDN Strategy

```typescript
// Public event pages — cached at Cloudflare edge
setResponseHeaders(
  new Headers({
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  }),
);
```

Cache invalidation triggers: event publish/unpublish, pricing changes, seat-count changes, admin moderation.

---

## Key Constraints

- TanStack Start RC — pin exact version (v1.154+), validate before upgrading
- Vite is the sole build tool (`vite.config.ts`) — Vinxi removed June 2025
- Shared Zod schemas in `packages/shared` — imported by both `apps/web` and `apps/api`
- Never import from `apps/api` directly — communicate via API calls only
- Use pnpm `catalog:` protocol for dependency versioning
- Tailwind v4 (CSS-first config, no `tailwind.config.js`)
- shadcn/ui v4 for component library
