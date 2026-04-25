# Implementation Plan: I-0.3.4 — Error Handling Patterns

**Module:** 0.3 — Design System & App Shell
**Scope:** `apps/web` only (frontend)
**Dependencies:** I-0.3.1 ✅ (layout shell), I-0.3.6 ✅ (API client)
**Requirement:** F-0.3.4 — Error handling and loading state patterns (error portion)

## Requirements

### Acceptance Criteria

1. **Route error boundary:** Unhandled JS errors in any route render a user-friendly error fallback with a "Try Again" button (calls TanStack Router's `reset()`)
2. **404 not-found page:** Navigating to a non-existent route shows a styled 404 page with "Go Home" navigation
3. **API error display:** `ApiClientError` responses can be rendered inline with consistent, user-friendly messaging
4. **Router-level defaults:** `defaultErrorComponent` and `defaultNotFoundComponent` configured in `router.tsx`
5. **Root catch-all:** Root route has `notFoundComponent` so unknown paths render the 404 page
6. **Responsive:** All error components are mobile-first (consistent with I-0.3.1 layout shell)
7. **Dev mode:** Error fallback shows stack trace in development, hides it in production
8. **Tests:** All components have Vitest + jsdom tests covering rendering, interactions, and error states

### Security

- Error messages never expose internal details (stack traces, SQL, file paths) in production
- API error display sanitizes `details` field — only renders known safe keys

### Performance

- Error components are lightweight — no heavy imports or lazy-loaded dependencies
- No API calls in error components (they must render even when the API is down)

## Implementation Steps

### Task 1: Error fallback component `[new]` — S

**File:** `apps/web/src/components/error/error-fallback.tsx`

Generic route-level error boundary fallback. Implements TanStack Router's `ErrorComponentProps` interface.

**Key details:**

- Props: `{ error: Error; reset: () => void }` (from `ErrorComponentProps`)
- Renders: error icon, heading ("Something went wrong"), user-friendly message, "Try Again" button
- Dev mode: shows `error.message` and stack trace in a collapsible `<pre>` block (checks `import.meta.env.DEV`)
- Production: shows generic "An unexpected error occurred" message
- Uses `@repo/ui` Button component
- Centered layout, responsive (mobile-first)

### Task 2: Not-found page component `[new]` — S

**File:** `apps/web/src/components/error/not-found.tsx`

Styled 404 page for both router-level and route-level `notFoundComponent`.

**Key details:**

- Renders: large "404" text, heading ("Page not found"), description, "Go Home" button
- Uses `Link` from `@tanstack/react-router` to navigate to `/`
- Also renders `useRouter().state.location.pathname` to show what path was not found
- Uses `@repo/ui` Button component
- Centered, responsive layout

### Task 3: API error alert component `[new]` — S

**File:** `apps/web/src/components/error/api-error-alert.tsx`

Inline alert for displaying API errors in forms and page sections.

**Key details:**

- Props: `{ error: ApiClientError | Error | null; onDismiss?: () => void; className?: string }`
- Returns `null` when `error` is null (convenient for conditional rendering)
- For `ApiClientError`: maps common status codes to user-friendly messages:
  - 401 → "Please sign in to continue"
  - 403 → "You don't have permission to do this"
  - 404 → "The requested resource was not found"
  - 409 → "This conflicts with existing data"
  - 422 → "Please check your input and try again"
  - 429 → "Too many requests — please wait a moment"
  - 500+ → "Something went wrong on our end"
- For generic `Error`: shows `error.message`
- Uses `@repo/ui` Alert component (destructive variant) with AlertTitle, AlertDescription
- Optional dismiss button (X icon) when `onDismiss` is provided
- Exposes error code as small text for support reference

### Task 4: Barrel export `[new]` — S

**File:** `apps/web/src/components/error/index.ts`

Re-exports all error components for convenient imports.

### Task 5: Wire router defaults `[modify]` — S

**File:** `apps/web/src/router.tsx`

- Import `ErrorFallback` and `NotFoundPage` from `#/components/error`
- Add `defaultErrorComponent: ErrorFallback` to `createTanStackRouter()` options
- Add `defaultNotFoundComponent: NotFoundPage` to `createTanStackRouter()` options

### Task 6: Wire root route catch-all `[modify]` — S

**File:** `apps/web/src/routes/__root.tsx`

- Import `NotFoundPage` from `#/components/error`
- Add `notFoundComponent: NotFoundPage` to the root route definition
- This ensures the 404 page renders within the app shell (with `<head>`, scripts, etc.)

### Task 7: Tests — error fallback `[new]` — M

**File:** `apps/web/src/components/error/error-fallback.test.tsx`

Tests:

- Renders heading and "Try Again" button
- Calls `reset()` when "Try Again" is clicked
- Shows error message in dev mode (`import.meta.env.DEV = true`)
- Hides stack trace in production mode

### Task 8: Tests — not-found page `[new]` — S

**File:** `apps/web/src/components/error/not-found.test.tsx`

Tests:

- Renders 404 heading and "Go Home" link
- Link points to `/`

### Task 9: Tests — API error alert `[new]` — M

**File:** `apps/web/src/components/error/api-error-alert.test.tsx`

Tests:

- Returns null when error is null
- Renders user-friendly message for each status code (401, 403, 404, 409, 429, 500)
- Renders generic Error message
- Calls onDismiss when dismiss button clicked
- Shows error code for ApiClientError

## Files Summary

| File                                                     | Action | Workspace |
| -------------------------------------------------------- | ------ | --------- |
| `apps/web/src/components/error/error-fallback.tsx`       | new    | web       |
| `apps/web/src/components/error/not-found.tsx`            | new    | web       |
| `apps/web/src/components/error/api-error-alert.tsx`      | new    | web       |
| `apps/web/src/components/error/index.ts`                 | new    | web       |
| `apps/web/src/router.tsx`                                | modify | web       |
| `apps/web/src/routes/__root.tsx`                         | modify | web       |
| `apps/web/src/components/error/error-fallback.test.tsx`  | new    | web       |
| `apps/web/src/components/error/not-found.test.tsx`       | new    | web       |
| `apps/web/src/components/error/api-error-alert.test.tsx` | new    | web       |

## Design Decisions

1. **Components in `apps/web/src/components/error/`** — not `packages/ui` because they depend on TanStack Router context and `ApiClientError` which are app-specific
2. **TanStack Router native integration** — uses `defaultErrorComponent`, `defaultNotFoundComponent`, and route-level `notFoundComponent` (the recommended approach per TanStack Router docs)
3. **Root route `notFoundComponent`** — ensures 404s render within the full app shell (html, head, scripts)
4. **No React class-based ErrorBoundary** — TanStack Router handles error boundaries internally; we just provide the component to render
5. **Status code mapping in ApiErrorAlert** — hardcoded map of common HTTP status codes to user-friendly messages (no external dependency)
