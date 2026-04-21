# EventKart web app

`apps/web` is the TanStack Start frontend for EventKart. It runs on Vite and follows the workspace's split env model.

## Common commands

```sh
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web check
pnpm --filter web check-types
pnpm --filter web test
```

## Environment model

Copy `apps/web/.env.example` to `apps/web/.env.local` for local development.
The checked-in example assumes the API is running locally on `http://localhost:3001`.

### Public env

Client-safe values live behind the `VITE_` prefix and are validated through:

- `src/lib/env/public.ts`

Current public values:

- `VITE_APP_TITLE`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`

### Server-only env

Frontend server-only values are parsed from:

- `src/lib/env/server.ts`

Current server-only values:

- `INTERNAL_API_URL`
- `SERVER_URL`

Do not access `import.meta.env` directly in feature code. Use `publicEnv` for client-safe values and `serverEnv` for server-only values.
Override `INTERNAL_API_URL` in deployed environments where the frontend can reach the API over an internal network hostname.

## Runtime conventions

### TanStack Start route split

The app uses a mixed rendering model:

- public discovery pages are SSR-oriented
- booking and dashboard flows rely on the app's auth-aware route layout strategy
- browser-only capabilities stay out of the SSR path

### Data fetching

- keep query factories in feature-local `queries.ts` files
- use route loaders with `ensureQueryData`
- keep server-only helpers out of client-importable modules

### API communication

- SSR/server-function code can use `INTERNAL_API_URL` for internal network calls
- browser code talks to the public API surface

## Validation

This package uses:

- Biome for linting, formatting, and checks
- `tsc --noEmit` for type-checking
- Vitest for tests

`pnpm --filter web test` is intentionally clean when no tests exist yet.
