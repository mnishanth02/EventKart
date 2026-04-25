# Implementation Plan: I-0.3.5 & I-0.3.3 — Loading States & Role-Based Routing

**Module:** 0.3 — Design System & App Shell
**Scope:** `apps/web` only (frontend)
**Dependencies:** I-0.3.1 ✅ (layout shell), I-0.3.6 ✅ (API client), I-0.2.4 ✅ (RBAC middleware), I-0.3.4 ✅ (error handling), I-0.2.7 ✅ (deferred auth), I-0.2.9 ✅ (SSR session forwarding)
**Requirements:** F-0.3.4 (loading portion), F-0.3.3 (role-based routing)

---

## Feature 1: I-0.3.5 — Loading State Patterns

### Acceptance Criteria

1. **Route pending component:** Navigation between routes shows a top-of-page progress bar (not a full-page blocker) — wired as TanStack Router's `defaultPendingComponent`
2. **Full-page spinner:** Centered spinner for auth-check transitions (used by `_authed.tsx` while verifying session)
3. **Page skeleton:** Reusable configurable skeleton for page-level content loading (header + content area variants)
4. **Card skeleton:** Skeleton card matching the `EventCardPlaceholder` pattern — reusable for any card grid
5. **Table skeleton:** Skeleton for data tables (header row + N body rows) — for dashboard views
6. **Form skeleton:** Skeleton for form layouts (label + input pairs)
7. **Barrel exports:** All loading components exported from `#/components/loading`
8. **Responsive:** All components are mobile-first
9. **Accessible:** Spinners have `role="status"` and `aria-label`; skeletons have `aria-hidden="true"`
10. **Tests:** Vitest + jsdom coverage for all components

### Security / Performance

- Loading components are lightweight — no API calls, no heavy dependencies
- Skeletons use CSS `animate-pulse` only (no JS animation loops)
- No user data in loading states

### Implementation Steps

#### Task 1: Route pending component `[new]` — S

**File:** `apps/web/src/components/loading/route-loading.tsx`

Top-of-page indeterminate progress bar shown during route transitions. Uses `@repo/ui` Progress component with an animated indeterminate state.

**Key details:**

- Renders a thin fixed-top progress bar (h-0.5) with animated fill using CSS keyframes
- `aria-label="Loading page"` for screen readers
- Does NOT block the current page — sits above content

#### Task 2: Full-page spinner `[new]` — S

**File:** `apps/web/src/components/loading/full-page-spinner.tsx`

Centered, full-viewport spinner for initial auth verification and layout transitions.

**Key details:**

- Uses `@repo/ui` Spinner component (Loader2Icon) at `size-8`
- Centered vertically and horizontally with flexbox
- Optional `label` prop (renders visually hidden text below spinner)
- `min-h-[50vh]` to avoid layout shift

#### Task 3: Page skeleton `[new]` — S

**File:** `apps/web/src/components/loading/page-skeleton.tsx`

Configurable skeleton for page-level content loading.

**Key details:**

- Props: `{ variant: "default" | "detail" | "dashboard"; className?: string }`
- `default`: Title bar + 3 content blocks
- `detail`: Wide header image + title + 2-column body
- `dashboard`: Stat cards row + wide content area
- Uses `@repo/ui` Skeleton component
- `aria-hidden="true"` on container

#### Task 4: Card skeleton `[new]` — S

**File:** `apps/web/src/components/loading/card-skeleton.tsx`

Skeleton card for grid layouts (event cards, etc).

**Key details:**

- Props: `{ count?: number; className?: string }`
- Defaults to `count=3`
- Renders `count` cards in a responsive grid (1col → 2col → 3col)
- Each card: aspect-video image + 3 text lines + footer row (matches EventCardPlaceholder pattern)
- Uses `@repo/ui` Skeleton with border and rounded corners

#### Task 5: Table skeleton `[new]` — S

**File:** `apps/web/src/components/loading/table-skeleton.tsx`

Skeleton for data table views.

**Key details:**

- Props: `{ rows?: number; columns?: number; className?: string }`
- Defaults: `rows=5`, `columns=4`
- Renders header row (wider skeletons) + body rows
- Uses `@repo/ui` Skeleton
- `aria-hidden="true"`

#### Task 6: Form skeleton `[new]` — S

**File:** `apps/web/src/components/loading/form-skeleton.tsx`

Skeleton for form layouts.

**Key details:**

- Props: `{ fields?: number; className?: string }`
- Defaults: `fields=4`
- Renders N label+input pairs in a vertical stack + a button skeleton at bottom
- Uses `@repo/ui` Skeleton

#### Task 7: Barrel exports `[new]` — S

**File:** `apps/web/src/components/loading/index.ts`

Re-exports all loading components.

#### Task 8: Wire router default pending component `[modify]` — S

**File:** `apps/web/src/router.tsx`

- Import `RouteLoading` from `#/components/loading`
- Add `defaultPendingComponent: RouteLoading` to `createTanStackRouter()` options
- Add `defaultPendingMs: 200` (avoid flash for fast navigations)
- Add `defaultPendingMinMs: 300` (ensure spinner shows long enough to be perceived)

#### Task 9: Tests — loading components `[new]` — M

**File:** `apps/web/src/components/loading/loading.test.tsx`

Tests for all loading components:

- RouteLoading: renders progress bar with correct aria-label
- FullPageSpinner: renders spinner, renders custom label text
- PageSkeleton: renders correct variant structure (default, detail, dashboard)
- CardSkeleton: renders correct number of cards based on `count` prop
- TableSkeleton: renders correct rows/columns
- FormSkeleton: renders correct number of fields

---

## Feature 2: I-0.3.3 — Role-Based Routing and Navigation Structure

### Acceptance Criteria

1. **Authed pathless layout:** `_authed.tsx` verifies session via `beforeLoad` — redirects to `/` with toast if unauthenticated
2. **Participant routes:** `/my/*` accessible to any authenticated user (role ≥ participant)
3. **Organizer routes:** `/org/*` accessible to organizer+ role — 403 redirect for insufficient role
4. **Admin routes:** `/admin/*` accessible to admin role only — 403 redirect for insufficient role
5. **Sidebar navigation:** Each role area has a collapsible sidebar with role-appropriate navigation items
6. **SSR mode:** All `_authed/*` routes use `ssr: false` (no server-side auth check needed — client-side auth query handles it)
7. **Placeholder dashboards:** Each role area has a minimal index route (coming soon)
8. **Auth loading:** While session query is in-flight, show `FullPageSpinner` (from I-0.3.5)
9. **Deep link preservation:** After login redirect, user returns to originally requested URL
10. **Tests:** Route guard logic, navigation rendering, redirect behavior

### Security

- Role checks happen on the frontend for UX — actual data access is protected by API-layer RBAC (`requireAuth`, `requireRole` middleware)
- Frontend guards are a UX convenience, not a security boundary
- No sensitive data is exposed in route components — data comes from auth-gated API endpoints

### Design Decisions

1. **Sidebar layout** — Dashboard routes use shadcn/ui `SidebarProvider` + `Sidebar` for navigation. Mobile: sheet overlay. Desktop: collapsible sidebar. `SidebarProvider` lives in `_authed.tsx` (shared state across all role areas).
2. **`beforeLoad` + direct server function** — Auth check runs in `beforeLoad` by calling `getCurrentUser()` directly (NOT `ensureQueryData`). The 30s stale cache in `sessionQueryOptions` is too stale for route guards — a role change or logout could leave stale permissions. The direct call ensures fresh auth on every navigation. The result is passed to children via `context.user`.
3. **Redirect to `/` for unauthenticated** — Protected dashboard routes redirect to home with a typed search param (`?reason=auth-required`). The deferred auth pattern (I-0.2.7) is for booking flows, not dashboards.
4. **Redirect to `/` for insufficient role** — Typed search param (`?reason=forbidden`). Toast shown once, param cleared via `replace` navigation.
5. **`ssr: 'data-only'`** — Per `tanstack-start.instructions.md`, authed dashboard routes use `ssr: 'data-only'` (NOT `ssr: false`). Server runs `beforeLoad` to check auth and redirects before sending HTML. `ssr: false` is reserved for browser-API-only routes like camera/QR.
6. **Typed redirect params** — Home page uses `validateSearch` with Zod to type the `reason` param. Toast fires once on mount, then param is cleared with `router.navigate({ search: {}, replace: true })`.
7. **Role typing** — Tighten `AuthSession.role` from `string` to `UserRole` (from `@repo/shared/constants/roles`). Validate in `getCurrentUser()` server function with `userRoleSchema.safeParse()`.
8. **Nav items only for implemented pages** — Sidebar nav links only point to routes that exist (the placeholder index pages). No links to unimplemented child routes.

### Route Structure

```
routes/
├── __root.tsx                    [existing]
├── _public.tsx                   [existing]
├── _public/
│   └── index.tsx                 [existing]
├── _authed.tsx                   [NEW — auth guard layout]
├── _authed/
│   ├── my.tsx                    [NEW — participant layout + sidebar]
│   ├── my/
│   │   └── index.tsx             [NEW — /my dashboard placeholder]
│   ├── org.tsx                   [NEW — organizer layout + sidebar]
│   ├── org/
│   │   └── index.tsx             [NEW — /org dashboard placeholder]
│   ├── admin.tsx                 [NEW — admin layout + sidebar]
│   └── admin/
│       └── index.tsx             [NEW — /admin dashboard placeholder]
```

### Navigation Items

**Participant (`/my/*`):**

- My Bookings (`/my/bookings`) — placeholder
- My Profile (`/my/profile`) — placeholder

**Organizer (`/org/*`):**

- Dashboard (`/org`) — placeholder
- My Events (`/org/events`) — placeholder
- Profile (`/org/profile`) — placeholder

**Admin (`/admin/*`):**

- Dashboard (`/admin`) — placeholder
- Verifications (`/admin/verifications`) — placeholder
- Event Reviews (`/admin/event-reviews`) — placeholder

### Implementation Steps

#### Task 10: Authed layout — auth guard `[new]` — M ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed.tsx`

Pathless layout route that protects all child routes behind authentication.

**Key details:**

- `beforeLoad`: calls `getCurrentUser()` directly (fresh auth, not cached query). If `null`, throws `redirect({ to: "/", search: { reason: "auth-required" } })`. Passes `{ user }` to child routes via route context.
- `component`: renders `SidebarProvider` wrapper + `Outlet`
- `pendingComponent`: renders `FullPageSpinner` (from I-0.3.5) while auth check runs
- `ssr: 'data-only'` — server runs beforeLoad for auth redirect before sending HTML

#### Task 11: Authed sidebar component `[new]` — M ✅ (2026-04-23)

**File:** `apps/web/src/components/layout/authed-sidebar.tsx`

Shared sidebar component for all authed areas. Renders different nav items based on the active role area.

**Key details:**

- Props: `{ area: "my" | "org" | "admin"; user: AuthSession }`
- Uses `@repo/ui` Sidebar components (SidebarProvider, Sidebar, SidebarContent, SidebarGroup, etc.)
- Logo/brand at top linking to `/`
- Nav items for the current area (from a config map)
- Footer: user info (truncated userId) + logout button
- Mobile: renders as Sheet overlay via shadcn/ui Sidebar built-in mobile support
- Desktop: collapsible sidebar with keyboard shortcut (Ctrl+B)

#### Task 12: Authed header component `[new]` — S ✅ (2026-04-23)

**File:** `apps/web/src/components/layout/authed-header.tsx`

Slim top header for authed pages — sidebar toggle + breadcrumb area + theme toggle.

**Key details:**

- Uses `SidebarTrigger` for mobile menu toggle
- Shows current area name as breadcrumb
- Theme toggle on the right
- Sticky top, h-12

#### Task 13: Participant layout `[new]` — M ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/my.tsx`

Layout route for `/my/*` — any authenticated user (participant+).

**Key details:**

- `beforeLoad`: session already verified by parent `_authed.tsx`. Reads `context.user` from parent. Additional check: `hasMinimumRole(context.user.role, "participant")` — always true for any authed user, but explicit.
- `component`: renders `AuthedSidebar` (area="my") + `AuthedHeader` + `Outlet` in a flex layout
- `ssr: 'data-only'`

#### Task 14: Participant dashboard placeholder `[new]` — S ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/my/index.tsx`

Placeholder page for `/my` — "My Dashboard" with coming soon content.

#### Task 15: Organizer layout `[new]` — M ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/org.tsx`

Layout route for `/org/*` — requires organizer+ role.

**Key details:**

- `beforeLoad`: reads `context.user` from parent. Checks `hasMinimumRole(context.user.role, "organizer")`. If insufficient, throws `redirect({ to: "/", search: { reason: "forbidden" } })`.
- `component`: renders `AuthedSidebar` (area="org") + `AuthedHeader` + `Outlet`
- `ssr: 'data-only'`

#### Task 16: Organizer dashboard placeholder `[new]` — S ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/org/index.tsx`

Placeholder page for `/org` — "Organizer Dashboard" with coming soon content.

#### Task 17: Admin layout `[new]` — M ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/admin.tsx`

Layout route for `/admin/*` — requires admin role.

**Key details:**

- `beforeLoad`: reads `context.user` from parent. Checks `hasMinimumRole(context.user.role, "admin")`. If insufficient, throws `redirect({ to: "/", search: { reason: "forbidden" } })`.
- `component`: renders `AuthedSidebar` (area="admin") + `AuthedHeader` + `Outlet`
- `ssr: 'data-only'`

#### Task 18: Admin dashboard placeholder `[new]` — S ✅ (2026-04-23)

**File:** `apps/web/src/routes/_authed/admin/index.tsx`

Placeholder page for `/admin` — "Admin Dashboard" with coming soon content.

#### Task 19: Auth redirect toast handler `[modify]` — S ✅ (2026-04-23)

**File:** `apps/web/src/routes/_public/index.tsx`

Handle typed `reason` search param to show toast on redirect from protected routes.

**Key details:**

- Add `validateSearch` with Zod: `z.object({ reason: z.enum(["auth-required", "forbidden"]).optional() })`
- In component, read `reason` from `Route.useSearch()`
- If `reason === "auth-required"`: show toast "Please sign in to access that page"
- If `reason === "forbidden"`: show toast "You don't have access to that area"
- Clear param after toast with `router.navigate({ search: {}, replace: true })`
- Use `useEffect` with `reason` dependency to fire once

#### Task 20: Tighten AuthSession role type `[modify]` — S

**File:** `apps/web/src/lib/auth/server-fns.ts`

- Change `AuthSession.role` from `string` to `UserRole` (from `@repo/shared/constants/roles`)
- Validate role with `userRoleSchema.safeParse()` in `getCurrentUser()` — treat invalid role as unauthenticated (return null)

**File:** `apps/web/src/features/auth/types.ts`

- Update `AuthSession` re-export to reflect `UserRole` type

#### Task 21: Tests — role-based routing `[new]` — L

**File:** `apps/web/src/routes/_authed/authed-routing.test.tsx`

Tests for route guard logic:

- Authenticated user can access `/my`
- Unauthenticated user is redirected from `/my`
- Participant cannot access `/org` (role insufficient)
- Organizer can access `/org`
- Non-admin cannot access `/admin`
- Admin can access `/admin`

**File:** `apps/web/src/components/layout/authed-sidebar.test.tsx`

Tests for sidebar:

- Renders correct nav items for each area
- Renders user info in footer
- Logout button present

---

## Execution Order

I-0.3.5 and I-0.3.3 can be implemented in parallel EXCEPT that `_authed.tsx` depends on `FullPageSpinner` from I-0.3.5.

**Recommended order:**

1. Tasks 1–7 (I-0.3.5 loading components) — no dependencies
2. Task 8 (wire router pending) — depends on Task 1
3. Task 9 (loading tests) — depends on Tasks 1–7
4. Tasks 10–12 (authed layout + sidebar + header) — depends on Task 2 (FullPageSpinner)
5. Tasks 13–18 (role layouts + placeholders) — depends on Tasks 10–12
6. Task 19 (redirect toast) — depends on Task 10
7. Task 20 (routing tests) — depends on Tasks 10–18

## Files Summary

| File                                                     | Action | Workspace | Feature |
| -------------------------------------------------------- | ------ | --------- | ------- |
| `apps/web/src/components/loading/route-loading.tsx`      | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/full-page-spinner.tsx`  | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/page-skeleton.tsx`      | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/card-skeleton.tsx`      | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/table-skeleton.tsx`     | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/form-skeleton.tsx`      | new    | web       | I-0.3.5 |
| `apps/web/src/components/loading/index.ts`               | new    | web       | I-0.3.5 |
| `apps/web/src/router.tsx`                                | modify | web       | I-0.3.5 |
| `apps/web/src/components/loading/loading.test.tsx`       | new    | web       | I-0.3.5 |
| `apps/web/src/routes/_authed.tsx`                        | new    | web       | I-0.3.3 |
| `apps/web/src/components/layout/authed-sidebar.tsx`      | new    | web       | I-0.3.3 |
| `apps/web/src/components/layout/authed-header.tsx`       | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/my.tsx`                     | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/my/index.tsx`               | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/org.tsx`                    | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/org/index.tsx`              | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/admin.tsx`                  | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/admin/index.tsx`            | new    | web       | I-0.3.3 |
| `apps/web/src/routes/_public/index.tsx`                  | modify | web       | I-0.3.3 |
| `apps/web/src/lib/auth/server-fns.ts`                    | modify | web       | I-0.3.3 |
| `apps/web/src/features/auth/types.ts`                    | modify | web       | I-0.3.3 |
| `apps/web/src/routes/_authed/authed-routing.test.tsx`    | new    | web       | I-0.3.3 |
| `apps/web/src/components/layout/authed-sidebar.test.tsx` | new    | web       | I-0.3.3 |
