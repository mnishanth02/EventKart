# Infrastructure — Railway deployment for EventKart

**Status:** 🟡 Planning
**Type:** Infrastructure / cross-cutting
**Created:** 2026-05-02
**Owner:** Engineering
**Depends on:** I-0.1.9 (CI/CD scaffolding — workflows already reference Railway), I-2.4.1 (Cloudflare CDN runbook)
**Downstream:** First production launch (Phase 7 pre-launch gates), I-7.x ops runbooks

---

## 1. Problem

EventKart needs a production deployment target. The codebase is already
shaped for a multi-service deploy:

- `apps/api` — Fastify v5, builds to `dist/server.js`, listens on `HOST` /
  `PORT`, exposes `/health` (process up) and `/ready` (Postgres + Redis
  pings).
- `apps/web` — TanStack Start (Vite + Nitro), builds to
  `.output/server/index.mjs`. The current public env schema has 11
  build-time `VITE_*` env vars that are inlined by Vite at build, so
  they must be present in the build environment.
- `apps/api/src/workers/index.ts` — BullMQ worker entrypoint that boots 7
  workers (payment, email, cleanup, exports, cdn-purge, razorpay, sitemap-
  regen) plus a nightly sitemap-regen cron. Has a SIGTERM handler.
- `Postgres 17` + `Redis 7` (currently only docker-compose for local dev).

I-0.1.9 already shipped three GitHub Actions workflows
(`.github/workflows/ci.yml`, `deploy-staging.yml`, `deploy-production.yml`)
that **reference** Railway (`@railway/cli up --service api|web|worker`,
`RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, healthcheck URLs) but **no Railway
project, no Dockerfile, no `railway.json`, no env-var matrix, and no DNS
records exist yet**. The workflows would fail today.

We also surfaced 7 code-side gaps during the discovery pass that block a
clean Railway deploy:

1. **Fastify `HOST` defaults to `0.0.0.0`.** Railway's [Fastify guide](https://docs.railway.com/guides/fastify)
   is explicit: `.listen({ host: "::" })` is required for the dual-stack
   bind their networking expects, otherwise the public proxy returns
   502s. Our default is in [apps/api/src/lib/config.ts](apps/api/src/lib/config.ts).
2. **Worker auto-start guard is `.ts`-only.** [apps/api/src/workers/index.ts:195](apps/api/src/workers/index.ts) uses
   `process.argv[1]?.endsWith("workers/index.ts")` to detect direct
   execution. After `tsc` compiles to `dist/workers/index.js` the guard
   silently returns false and **no workers start**.
3. **`apps/web` has a `/health` endpoint but it is not deployment-hardened.**
   [apps/web/src/routes/health.ts](apps/web/src/routes/health.ts) already
   returns `Response.json({ status: "ok" })`, which matches TanStack Start's
   current server-route docs, but it does not set `Cache-Control: no-store`
   and has no colocated regression test.
4. **TanStack Start is not explicitly configured to listen on Railway's `PORT`.**
   Railway's [TanStack Start guide](https://docs.railway.com/guides/tanstack-start)
   documents `.output/server/index.mjs` as the Node entry point and requires
   the Vinxi/Nitro server to respect `process.env.PORT` (via `app.config.ts`,
   or a shell-wrapped start command). This repo currently has no
   `apps/web/app.config.ts`, so we must add one before relying on Railway
   healthchecks.
5. **Migrations run from the GitHub runner before `railway up`** in the
   existing CD workflows. If the Railway deploy fails, schema is
   already advanced — code can lag the schema for an entire fix-and-
   redeploy cycle. Railway's native `preDeployCommand` runs after image
   build and before the application container starts, blocking rollout on
   non-zero exit.
6. **`serverEnv.INTERNAL_API_URL` is undocumented for Railway.** The
   SSR→API hop will work on the public domain but pays public-egress
   cost + TLS handshake on every server function call. Railway's [private
   network](https://docs.railway.com/networking/private-networking) gives
   us `http://api.railway.internal:$PORT` for free, encrypted via
   Wireguard, no public hop.
7. **Redis/BullMQ clients are not private-network hardened.** Railway's
   [private-network library configuration](https://docs.railway.com/networking/private-networking/library-configuration)
   recommends `family: 0` for ioredis and BullMQ so clients can connect across
   Railway's IPv4/IPv6 private DNS modes. [apps/api/src/lib/redis.ts](apps/api/src/lib/redis.ts)
   and the standalone worker connection in [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts)
   currently omit it.

The docs review also caught one **plan-side** gap: Railway's current
[GitHub autodeploy documentation](https://docs.railway.com/deployments/github-autodeploys)
is branch-trigger based and supports "Wait for CI" on push workflows, but does
not document native `v*` tag-triggered autodeploys. Production tag deploys
therefore stay in GitHub Actions (no migrations there; the Railway api
`preDeployCommand` still owns migrations).

### Official-docs review notes (2026-05-02)

- TanStack Start official hosting docs list Railway as an official hosting
  partner and document Node/Docker deployment as `vite build` followed by
  `node .output/server/index.mjs`.
- Railway's TanStack Start guide confirms the `.output/server/index.mjs`
  entry point and explicitly calls out `PORT` handling via `app.config.ts` or
  a shell-wrapped start command.
- Railway's Fastify guide requires `.listen({ host: "::" })` to avoid 502s on
  their public/private networking path.
- Railway Docker builds expose service variables at build time only when each
  needed variable is declared as a Dockerfile `ARG` in the stage that uses it.
- Railway's frontend env guide confirms `VITE_*` values are build-time values
  baked into the client bundle; changing them requires a rebuild/redeploy, and
  secrets must never use a public prefix.
- Railway pre-deploy commands run in a separate container from the app image,
  have access to the private network and service env vars, are not retried,
  and require all migration dependencies to already exist in the image.
- Railway private networking is runtime-only (not available during Docker
  builds), uses `*.railway.internal` DNS, and recommends `http://` for internal
  HTTP because traffic is already encrypted by Wireguard.
- Railway's Redis/BullMQ library guidance recommends `family: 0` for clients
  that connect over the private network.
- Railway config-as-code files override dashboard settings for a deployment,
  but dashboard settings are not mutated. In monorepos, the config-file path
  does not follow the service root directory; point each service at the
  root-level file explicitly (for example `/railway.api.json`).

There is also an out-of-scope hardening item flagged in
[memory: cache security] worth re-stating: the global `onRequest` cookie-
clear hook in [apps/api/src/plugins/auth.ts](apps/api/src/plugins/auth.ts)
writes `Set-Cookie` on every response. Combined with `Cache-Control:
public` on a CDN this is a session-cookie leak vector. The Cloudflare
CDN sits in front of `apps/web` only (per
[docs/operations/cloudflare-cdn-setup.md](docs/operations/cloudflare-cdn-setup.md));
`apps/api` is reached **directly** at `api.eventkart.run` so there is no
shared CDN cache for API responses. We document this constraint in the
new Railway runbook so the rule is not silently broken later.

## 2. Requirements & constraints

- **REQ-001** — Three Railway services per environment: `api`, `web`,
  `worker`. Plus managed `postgres` and `redis`.
- **REQ-002** — Two Railway projects: `eventkart-staging` (Railway GitHub
  autodeploy on every CI-passing merge to `main`, with Railway "Wait for CI"
  enabled) and `eventkart-production` (deploys only from GitHub Actions on
  `v*` git tags, the V1 release-tag flow). Railway native autodeploy stays
  disabled for production unless Railway later ships documented tag filters.
- **REQ-003** — Inter-service traffic stays on Railway's private network:
  web → api uses `http://api.railway.internal:3001` (or the equivalent
  `${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` reference variable), both api +
  worker use `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}`
  reference variables.
- **REQ-004** — Database migrations run as Railway `preDeployCommand` on
  the `api` service. The GH-Actions migration step is removed from the CD
  workflows. The `migration-ci.yml` PR check stays unchanged (drift +
  lock-risk + rollback validation still gate every PR).
- **REQ-005** — Singapore region (`asia-southeast1-eqsg3a`) — closest
  Railway POP to the Coimbatore launch market, ~30–60 ms RTT vs 250+ ms
  from US regions.
- **REQ-006** — Each deploy must declare its build + deploy contract in a
  service-scoped Railway config file checked into git (`railway.api.json`,
  `railway.web.json`, `railway.worker.json`). Each Railway service must set
  its Config File Path to the root-level file (for example
  `/railway.api.json`). Dashboard config drifts; checked-in config is the
  source of truth for each deployment.
- **REQ-007** — SIGTERM handlers in [apps/api/src/server.ts](apps/api/src/server.ts) and
  [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts) must be honored on
  zero-downtime deploys (`drainingSeconds = 30` so in-flight HTTP
  requests and BullMQ jobs finish before SIGKILL).
- **REQ-008** — Cloudflare stays in front of `apps/web` only. `apps/api`
  is reached directly. This preserves the cache-security invariant from
  [memory: cache security].
- **REQ-009** — The web service must listen on Railway's injected `PORT`.
  Add `apps/web/app.config.ts` with `server.port = Number(process.env.PORT) || 3000`
  (or an equivalent documented TanStack Start config) before first deploy.
- **SEC-001** — `INTERNAL_API_KEY` is a Railway shared secret across the
  `api` and `web` services in each environment. Rotate via Railway's
  variable replace flow; the `requireInternal` preHandler already added
  in I-2.3.6 enforces it on internal-only endpoints.
- **SEC-002** — `MIGRATION_DATABASE_URL` is identical to `DATABASE_URL`
  on Railway managed Postgres (no PgBouncer in the connection path) so
  we drop the old "bypass PgBouncer" complication from
  [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml).
- **SEC-003** — Cloudflare API token, Razorpay secret, MSG91 auth key,
  S3/R2 credentials, OTP_HMAC_SECRET, CSRF_SECRET, SENTRY_AUTH_TOKEN —
  all live as Railway service variables, never committed. The runbook
  documents the rotation cadence.
- **CON-001** — Vite inlines `VITE_*` at **build** time, so they must be
  present as build-time variables on the `web` service before the
  Dockerfile starts. Railway exposes service variables to the build
  container; we declare each `VITE_*` as a `Dockerfile` `ARG` to make
  the dependency explicit (silent missing vars otherwise produce a
  successful build that breaks at runtime). Current list from
  [apps/web/src/lib/env/public.ts](apps/web/src/lib/env/public.ts):
  `VITE_APP_TITLE`, `VITE_API_URL`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`,
  `VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED`, `VITE_PUBLIC_SUPPORT_PHONE`,
  `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`,
  `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`,
  `VITE_SITE_URL`.
- **CON-002** — `apps/api/Dockerfile` and the worker share a build
  artifact (both run from `apps/api/dist/`). For V1 we use **one image**
  with two Railway `deploy.startCommand` values; we split images later if
  worker memory pressure justifies it.
- **CON-003** — Worker runs compiled JS (`node dist/workers/index.js`),
  not `tsx`. Faster cold start, smaller runtime image, no source-map
  resolution overhead in the hot job-processing path.
- **CON-004** — Workers must NOT use Railway's `overlapSeconds` zero-
  downtime feature (could cause double-processing of the same job). Set
  `overlapSeconds = 0` for `worker`. Web + api use `overlapSeconds = 30`.
- **CON-005** — The api runtime image must be able to run the Railway
  `preDeployCommand`. Railway runs pre-deploy in a separate container using
  the application image, so `pnpm --filter @repo/db db:migrate:run` is only
  valid if the runtime image includes pnpm, the `@repo/db` migration script,
  the `packages/db/drizzle` migration files, and the dependencies needed by
  that script. A `pnpm deploy --filter api --prod /prod/api` image by itself
  is not enough unless the migration runner is copied/compiled into it.
- **CON-006** — Railway's documented Docker cache mount format requires a
  concrete service id in the mount `id` and environment variables cannot be
  used inside the id. Do not add guessed cache-mount ids to checked-in
  Dockerfiles. Prefer deterministic Docker layer caching first; add
  service-id-specific cache mounts only after provisioning if build timings
  justify the complexity.
- **GUD-001** — Per-service `railway.json` lives at the **repo root**
  for that service (Railway's [monorepo doc](https://docs.railway.com/deployments/monorepo)
  is explicit: "the Railway Config File does not follow the Root
  Directory path"). We use service-prefixed filenames + the
  dashboard Config File Path (`/railway.api.json`, `/railway.web.json`,
  `/railway.worker.json`) per service. Dockerfile paths live in those config
  files, not in ad-hoc service variables unless the dashboard cannot read the
  config path.
- **PAT-001** — Healthchecks: `api` → `/health` (process up, no DB
  hit), `web` → `/health` (existing endpoint hardened with `no-store`).
  `worker` has no healthcheck (Railway treats no-healthcheck workers as healthy on
  process-up). `/ready` (Postgres + Redis ping) stays as a separate,
  deeper probe used only by ops/dashboards.

## 3. Approach (overview)

```text
┌──────────────────────────  Railway project: eventkart-production  ───────────────────────────┐
│                                                                                              │
│   ┌──────────┐         private network          ┌──────────┐                                 │
│   │   web    │ ───INTERNAL_API_URL───────────►  │   api    │ ──┐                             │
│   │ (TanStack│   http://api.railway.internal    │ (Fastify)│   │                             │
│   │  Start)  │ ◄──Set-Cookie via PUBLIC_API_URL │          │   │ DATABASE_URL  REDIS_URL     │
│   └──────────┘                                  └──────────┘   │                             │
│        │                                              │         ▼                             │
│        │                                              │    ┌──────────┐    ┌──────────┐      │
│        │                                              │    │ Postgres │    │  Redis   │      │
│        │                                              │    │   17     │    │    7     │      │
│        │                                              │    └──────────┘    └──────────┘      │
│        │                                              │         ▲              ▲             │
│        │                                              │         │              │             │
│        │                                              │    ┌──────────┐        │             │
│        │                                              └────│  worker  │────────┘             │
│        │                                                   │ (BullMQ) │                      │
│        │                                                   └──────────┘                      │
│        │                                                                                    │
└────────│────────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   Cloudflare (proxy, cache, WAF) ── public users
   www.eventkart.run  →  web service
                          (api.eventkart.run is a DIRECT Railway domain;
                           no Cloudflare in front — preserves cookie-leak
                           invariant from `memory: cache security`)
```

Seven implementation phases, each independently verifiable.

## 4. Implementation steps

### Phase 1 — Code-side prep (must land before first deploy)

- GOAL-101: Fix the 7 code-side gaps that block a clean Railway deploy.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                  | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-101 | In [apps/api/src/lib/config.ts](apps/api/src/lib/config.ts), change `HOST` default from `"0.0.0.0"` to `"::"`. Update [apps/api/.env.example](apps/api/.env.example) to set `HOST=0.0.0.0` explicitly so local docker-compose still works on hosts without IPv6. Update any test that asserts the default.                                                                                                                                   |           |      |
| TASK-102 | In [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts), replace the `argv[1]?.endsWith("workers/index.ts")` direct-run guard with a robust check (e.g. `import.meta.url === pathToFileURL(process.argv[1] ?? "").href`). Add a vitest case asserting the guard returns `true` for both `.ts` and `.js` argv values.                                                                                                               |           |      |
| TASK-103 | Harden the existing TanStack Start server route at [apps/web/src/routes/health.ts](apps/web/src/routes/health.ts): keep the route path `/health`, keep it DB/API-free, and add `Cache-Control: no-store` to the `Response.json({ status: "ok" })` response. Add a colocated vitest that asserts both status/body and header.                                                                                                                 |           |      |
| TASK-104 | Add `apps/web/app.config.ts` (or the current TanStack Start equivalent) so the production server reads Railway's `PORT` env var and falls back to `3000`, matching Railway's official TanStack Start guide. Keep the Docker/web start command as `node .output/server/index.mjs`; only fall back to a shell-wrapped `PORT=$PORT node ...` command if app config cannot be used.                                                              |           |      |
| TASK-105 | Confirm `pnpm --filter api build` emits `apps/api/dist/workers/index.js`. If yes, change [apps/api/package.json](apps/api/package.json) `start:worker` from `tsx src/workers/index.ts` to `node dist/workers/index.js`. Keep a separate `dev:worker` script using `tsx` for local. (`tsconfig.build.json` already includes `src/**/*.ts` so this should "just work" — verify, don't assume.)                                                 |           |      |
| TASK-106 | Document `INTERNAL_API_URL=http://api.railway.internal:3001` (or `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` in Railway variables) in [apps/web/.env.example](apps/web/.env.example) with an inline comment naming Railway's private DNS pattern. Document the matching `VITE_API_URL` (public) for browser fetches. No code change in [apps/web/src/lib/env/server.ts](apps/web/src/lib/env/server.ts) — the schema already accepts both. |           |      |
| TASK-107 | Add Railway private-network Redis hardening: set `family: 0` in the shared ioredis helper [apps/api/src/lib/redis.ts](apps/api/src/lib/redis.ts) and in the standalone worker's direct Redis/BullMQ connection in [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts), then add/adjust tests that assert the option is passed.                                                                                                    |           |      |
| TASK-108 | Run `pnpm --filter api test` + `pnpm --filter web test` + `pnpm check-types` to confirm the gap fixes don't break the existing suites.                                                                                                                                                                                                                                                                                                       |           |      |

### Phase 2 — Container artifacts

- GOAL-201: Produce deterministic, cache-friendly Docker images for all
  three services using pnpm workspaces correctly.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-201 | Create `apps/api/Dockerfile` (multi-stage). **Stage 1 (deps):** `node:22.12-alpine`, `corepack enable && corepack prepare pnpm@10.33.2 --activate`, copy `package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml` + `turbo.json` + every workspace's `package.json`, run `pnpm install --frozen-lockfile`. **Stage 2 (build):** copy source, `pnpm --filter api... build`. **Stage 3 (runtime):** `node:22.12-alpine`, copy the api build artifact and production dependencies, and set default `CMD ["node", "dist/server.js"]`. Do **not** rely on Railway selecting a Docker build target; Railway's current docs expose Dockerfile path, not a documented `--target` selector. |           |      |
| TASK-202 | Make the api runtime image migration-capable for Railway `preDeployCommand`: include pnpm/corepack plus the `@repo/db` migration runner, `packages/db/drizzle` migration files, and required runtime dependencies **or** add a compiled production migration entrypoint that does not require `tsx`/workspace dev tooling. Validate by running the exact pre-deploy command inside the built image before using it on Railway.                                                                                                                                                                                                                                                      |           |      |
| TASK-203 | Create `apps/web/Dockerfile` mirroring the same 3-stage pattern but `pnpm --filter web... build` and `CMD ["node", ".output/server/index.mjs"]`. **Critical:** the build stage declares each `VITE_*` env var from [apps/web/src/lib/env/public.ts](apps/web/src/lib/env/public.ts) as `ARG` and re-exports them as `ENV` so Vite inlines them. Missing args must fail loudly instead of producing a broken bundle.                                                                                                                                                                                                                                                                 |           |      |
| TASK-204 | Reuse `apps/api/Dockerfile` for the worker by deploying the same image and overriding Railway `deploy.startCommand` to `node dist/workers/index.js` in `railway.worker.json`. Do **not** create a thin `apps/worker/Dockerfile` that references a stage from `apps/api/Dockerfile`; Docker stages are not addressable across files unless first published as an image, and Railway does not document service-level build-target selection.                                                                                                                                                                                                                                          |           |      |
| TASK-205 | Add a `.dockerignore` at repo root: `node_modules`, `**/node_modules`, `**/dist`, `**/.output`, `**/.turbo`, `apps/web/public/uploads`, `.env*`, `.git`, `coverage`, `*.log`, `docker-compose.yml`. Critical for build speed and to avoid leaking local `.env` files into images.                                                                                                                                                                                                                                                                                                                                                                                                   |           |      |
| TASK-206 | Local validation: `docker build -f apps/api/Dockerfile -t eventkart-api:test .` succeeds; image size < 350 MB. Reuse the same image for a worker smoke test by overriding the command to `node dist/workers/index.js`. `docker build -f apps/web/Dockerfile -t eventkart-web:test .` succeeds; image size target < 400 MB. Document measured sizes in the runbook.                                                                                                                                                                                                                                                                                                                  |           |      |
| TASK-207 | Smoke-run each image locally: `docker run --rm -p 3001:3001 -e PORT=3001 -e HOST=:: -e DATABASE_URL=... -e REDIS_URL=... eventkart-api:test` should hit `/health`. Same for web with `PORT=3000`. Worker should log "Workers started: …" within 5s when run with the worker command override.                                                                                                                                                                                                                                                                                                                                                                                       |           |      |

### Phase 3 — Railway config-as-code

- GOAL-301: Every build + deploy parameter for every service is committed
  to the repo. Dashboard is read-only after initial provisioning.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-301 | Create `railway.api.json` at repo root: `build.builder = "DOCKERFILE"`, `build.dockerfilePath = "apps/api/Dockerfile"`, `build.watchPatterns = ["apps/api/**", "packages/**", "pnpm-lock.yaml", "package.json", "turbo.json", "tsconfig.json"]`, `deploy.startCommand = "node dist/server.js"`, `deploy.healthcheckPath = "/health"`, `deploy.healthcheckTimeout = 300`, `deploy.restartPolicyType = "ON_FAILURE"`, `deploy.restartPolicyMaxRetries = 10`, `deploy.drainingSeconds = 30`, `deploy.overlapSeconds = 30`, `deploy.preDeployCommand = ["pnpm --filter @repo/db db:migrate:run"]`. |           |      |
| TASK-302 | Create `railway.web.json` at repo root: same shape, `dockerfilePath = "apps/web/Dockerfile"`, `watchPatterns = ["apps/web/**", "packages/ui/**", "packages/shared/**", "pnpm-lock.yaml", ...]`, `deploy.startCommand = "node .output/server/index.mjs"`, `healthcheckPath = "/health"`, `overlapSeconds = 30`, `drainingSeconds = 30`. **No `preDeployCommand`** — only `api` runs migrations.                                                                                                                                                                                                 |           |      |
| TASK-303 | Create `railway.worker.json` at repo root: `dockerfilePath = "apps/api/Dockerfile"` (shared api image), `watchPatterns = ["apps/api/**", "packages/**", ...]`, `deploy.startCommand = "node dist/workers/index.js"`, **no `healthcheckPath`**, `restartPolicyType = "ON_FAILURE"`, `restartPolicyMaxRetries = 10`, `drainingSeconds = 60` (BullMQ jobs need a longer drain), `overlapSeconds = 0` (never two workers at once on the same queues).                                                                                                                                              |           |      |
| TASK-304 | Each `railway.*.json` has a top-level `"$schema": "https://railway.com/railway.schema.json"` so editor IntelliSense + CI JSON-schema validation work. Add a JSON-schema check to `migration-ci.yml` (or a new `infra-ci.yml`) using `ajv-cli`.                                                                                                                                                                                                                                                                                                                                                 |           |      |

### Phase 4 — Railway provisioning + DNS

- GOAL-401: Two live Railway projects (`eventkart-staging`,
  `eventkart-production`) wired to GitHub, with custom domains, every
  env var documented and set, and the private network active.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-401 | Provision `eventkart-staging`: add 5 services (`postgres`, `redis`, `api`, `web`, `worker`). Region: `asia-southeast1-eqsg3a`. Connect each service to the GitHub repo (`mnishanth02/EventKart`, `development` branch initially, switch to `main` once Phase 6 smoke passes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |           |      |
| TASK-402 | For each non-DB service in staging, link the appropriate root-level config file via the dashboard Config File Path field: api → `/railway.api.json`, web → `/railway.web.json`, worker → `/railway.worker.json`. (Railway's [monorepo doc](https://docs.railway.com/deployments/monorepo) is explicit: config files don't follow the Root Directory path, so we must point to the root-level files explicitly.)                                                                                                                                                                                                                                                                                                                                                           |           |      |
| TASK-403 | Variable matrix for staging (every variable, every service). Use Railway template syntax for cross-service refs. Critical wiring: set explicit app ports (`api.PORT=3001`, `web.PORT=3000`) so healthchecks and private-network URLs are deterministic; `web.INTERNAL_API_URL = http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` (equivalent to `http://api.railway.internal:3001`), `web.VITE_API_URL = https://api-staging.eventkart.run`, `web.VITE_SITE_URL = https://staging.eventkart.run`, `api.WEB_ORIGIN = https://staging.eventkart.run`, `api.DATABASE_URL = ${{Postgres.DATABASE_URL}}`, `api.REDIS_URL = ${{Redis.REDIS_URL}}`, `worker.*` mirrors api except `PORT` is not needed. Document every variable in `docs/operations/railway-deployment-setup.md` §3. |           |      |
| TASK-404 | DNS: `staging.eventkart.run` (Cloudflare-proxied) → CNAME → Railway-provided `web` domain. `api-staging.eventkart.run` (Cloudflare DNS-only, no proxy) → CNAME → Railway-provided `api` domain. Verify Railway-issued cert provisions cleanly for both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |           |      |
| TASK-405 | Repeat 401–404 for `eventkart-production` with `eventkart.run` + `api.eventkart.run`. Production connects to the `main` branch for source metadata but Railway auto-deploy is disabled; production deploys are triggered only by the GitHub Actions `v*` tag workflow until Railway documents native tag filters.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |           |      |
| TASK-406 | Set Railway Project Usage cap on both projects (e.g. $50/mo staging, $200/mo production for the Coimbatore launch density target — adjust after measuring 30-day baseline). Cost guardrails so a runaway deploy can't burn the budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |           |      |

### Phase 5 — CI/CD wire-up

- GOAL-501: Migrations + deploys are atomic per environment. CI gates
  PRs but no longer pushes deploys.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-501 | Replace [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml) with a thin post-deploy verification job — no migration step, no `railway up`. Enable Railway "Wait for CI" on the staging services so Railway waits for the push workflow to pass before deploying `main`; the GitHub job then waits for the Railway deployment result/webhook and runs the post-deploy health-check curls.                                                                      |           |      |
| TASK-502 | Replace [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml) with the production release deploy path for `v*` tags: no migration step, but it still triggers Railway deployments for api/web/worker for the exact tag commit (Railway CLI/API is acceptable here because Railway native autodeploy is branch-based in current docs). Keep the `confirm: 'yes'` manual-dispatch path as an emergency rollback/redeploy override. Document in the runbook. |           |      |
| TASK-503 | Keep [.github/workflows/ci.yml](.github/workflows/ci.yml) and [.github/workflows/migration-ci.yml](.github/workflows/migration-ci.yml) unchanged — they remain the gate before merge to `main`. Confirm `ci.yml` still passes after the Phase 1 code changes.                                                                                                                                                                                                                          |           |      |
| TASK-504 | Add a new `.github/workflows/infra-ci.yml` that validates each `railway.*.json` against the [Railway JSON schema](https://railway.com/railway.schema.json) on every PR touching `railway.*.json` or any `Dockerfile`. Cheap (~10s) and catches typos before they hit Railway's "deploy failed because of bad config" feedback loop.                                                                                                                                                    |           |      |
| TASK-505 | Update `RAILWAY_TOKEN` rotation: document quarterly rotation in the runbook. The two tokens (staging + production) are scoped to their respective projects only.                                                                                                                                                                                                                                                                                                                       |           |      |

### Phase 6 — Verification (staging first, then production)

- GOAL-601: Every service in every environment is verified end-to-end
  before tagging the production release.

| Task     | Description                                                                                                                                                                                                                                                                                                                                           | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-601 | `curl https://api-staging.eventkart.run/health` → `200 {"status":"ok"}`. `curl https://api-staging.eventkart.run/ready` → `200` with both `postgres` + `redis` checks `ok`.                                                                                                                                                                           |           |      |
| TASK-602 | `curl https://staging.eventkart.run/health` → `200`. `curl -I https://staging.eventkart.run/events/<known-slug>` → `200` + `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Confirm Cloudflare `CF-Cache-Status` header transitions `MISS` → `HIT` on the second call.                                                               |           |      |
| TASK-603 | `curl https://staging.eventkart.run/sitemap.xml` → valid XML. (Routed by web through to api `/api/v1/sitemap.xml` per I-2.4.4.)                                                                                                                                                                                                                       |           |      |
| TASK-604 | `railway logs --service worker --environment staging` → confirm all 7 workers + the sitemap-regen cron tick logged at boot. Trigger a test event publish via the staging organizer dashboard → verify a CDN purge job + sitemap regen job both fire and the `/sitemap.xml` reflects the new event within 60s.                                         |           |      |
| TASK-605 | Run the existing test suites against the deployed staging api as a contract check: set `BASE_URL=https://api-staging.eventkart.run` and run a curated subset (health, ready, public events list, public event detail, public organizer profile). The full 921-test API suite stays a `app.inject()` in-process suite — not run against a live deploy. |           |      |
| TASK-606 | Repeat 601–605 against production (after the first `v0.1.0` tag is pushed). All checks must pass before declaring V1 launch-ready.                                                                                                                                                                                                                    |           |      |
| TASK-607 | Document the rollback procedure: `railway redeploy --service <svc> --deployment <previous-deployment-id>` from the dashboard; for migrations follow `packages/db/scripts/` rollback files (already validated by `db:check:rollbacks` in `migration-ci.yml`).                                                                                          |           |      |

### Phase 7 — Operations runbook

- GOAL-701: One document is the source of truth for every Railway-side
  decision so future operators don't have to re-derive it.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                        | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-701 | Create `docs/operations/railway-deployment-setup.md` mirroring the structure of [docs/operations/cloudflare-cdn-setup.md](docs/operations/cloudflare-cdn-setup.md): §1 Project topology, §2 Service config, §3 Env-var matrix (full table, ~30 vars × 2 envs), §4 DNS records, §5 Secret rotation cadence, §6 Rollback procedure, §7 Smoke-test curl commands, §8 Cost guardrails. |           |      |
| TASK-702 | Cross-reference: add a "Cloudflare in front of web only" note in §1 of the new runbook with a link to [docs/operations/cloudflare-cdn-setup.md](docs/operations/cloudflare-cdn-setup.md), naming the `auth.ts` cookie-clear hook as the reason `apps/api` is not behind Cloudflare. Avoids a future operator "fixing" the architecture and breaking the invariant.                 |           |      |
| TASK-703 | Update [README.md](README.md) "Deployment" section (if it exists) or add one, pointing at the new runbook + this plan. Single discoverable entry point.                                                                                                                                                                                                                            |           |      |
| TASK-704 | Update [progress.md](progress.md) with the final completion row and update [docs/v1-implementation-plan.md](docs/v1-implementation-plan.md) "Current State" to mark "Production deployment infrastructure" complete.                                                                                                                                                               |           |      |
| TASK-705 | Once all Phase 6 checks are green in production, archive this plan to `docs/archived/infrastructure-railway-deployment.md` per the progress-tracking instructions.                                                                                                                                                                                                                 |           |      |

## 5. Decisions

- **D1: Dockerfiles, not Railpack.** pnpm workspaces +
  worker's compiled-vs-tsx runtime + Vite's build-time `VITE_*` inlining
  and the shared api-worker base layer are too custom for auto-detect to
  be reliable. Dockerfiles give us deterministic, locally-reproducible
  builds. We start with Docker layer caching; Railway-specific cache mounts
  are optional only after service ids exist.
- **D2: Migrations move from GH Actions into Railway `preDeployCommand`.**
  Atomic with the deploy at the deploy-system level; eliminates the
  schema-ahead-of-code skew window. The PR-time `migration-ci.yml`
  drift / lock-risk / rollback validation stays exactly as is.
- **D3: Cloudflare in front of `web` only, `api` reached directly.**
  Preserves the cookie-leak invariant from [memory: cache security]
  (the global `Set-Cookie` cookie-clear hook in `apps/api/src/plugins/auth.ts`
  plus a shared CDN cache would be a session-leak vector).
- **D4: Singapore region (`asia-southeast1-eqsg3a`).** Closest Railway
  POP to the Coimbatore launch market.
- **D5: 5 services × 2 projects (staging + production).** No
  PR-environment ephemeral deploys for V1 — staging is the integration
  environment, ephemerals are a Phase-7+ ops upgrade.
- **D6 (updated after official-docs review): Production tag deploys stay in
  GitHub Actions.** Railway's current GitHub autodeploy docs describe
  branch-triggered deploys and "Wait for CI"; they do not document native
  `v*` tag filters. Staging uses Railway branch autodeploy + Wait for CI.
  Production keeps the `v*` GitHub Actions release workflow to trigger
  Railway deploys for the exact tag commit, with migrations still owned by
  Railway `preDeployCommand`.
- **D7 (was Future Consideration 2): Compiled worker
  (`node dist/workers/index.js`).** Faster cold start, smaller runtime
  image, no source-map resolution overhead in the hot job-processing
  path. Keep `tsx` for `dev:worker` only.
- **D8 (was Future Consideration 3): Shared api+worker image for V1.**
  One build cache; both deploy from a single `apps/api/Dockerfile` and use
  Railway `deploy.startCommand` to choose `node dist/server.js` vs.
  `node dist/workers/index.js`. Split images later if worker memory pressure
  requires it. Decision is reversible in one PR.

## 6. Alternatives

- **ALT-001: Use Railpack (Railway's auto-detect builder).** Rejected —
  Vite's build-time `VITE_*` inlining + the worker's compiled-vs-`tsx`
  runtime + the shared-base-image optimization are all custom enough
  that Railpack would produce either wrong builds or larger images. We
  pay a one-time Dockerfile authoring cost for deterministic, locally-
  reproducible builds. Documented for future reconsideration if Railpack
  adds first-class pnpm workspace + Vite env support.
- **ALT-002: One combined Railway service running api + worker in a
  single container.** Rejected — couples HTTP availability to job-
  processing health, loses independent restart policy and independent
  scaling, and a single SIGTERM would have to drain both surfaces.
- **ALT-003: Render / Fly.io instead of Railway.** Rejected — I-0.1.9
  already shipped Railway-targeted CD workflows (`@railway/cli up`,
  `RAILWAY_TOKEN` references). The V1 plan named Railway. Switching
  hosts would mean redoing CI/CD and is a Phase-7+ migration if we ever
  outgrow Railway's pricing.
- **ALT-004: Run migrations in a separate one-shot Railway service
  ("migrate") that exits 0 and gates the api deploy.** Rejected —
  Railway's `preDeployCommand` is the supported pattern, executes in
  the same image as the api (so the migration script and the consuming
  code are guaranteed compatible), and integrates with the deploy
  rollout state machine. A separate "migrate" service would need its
  own healthcheck-out logic and would not block api rollout natively.
- **ALT-005: Inject `VITE_*` at runtime via a server-side template
  layer.** Rejected — requires pulling Vite vars out of the bundle,
  re-injecting via a custom html-template middleware, and breaks the
  static-asset CDN model. The Dockerfile `ARG`+`ENV` pattern is the
  documented Vite/Railway approach.
- **ALT-006: Use Railway-native production `v*` tag autodeploy.** Rejected
  for now because the current official Railway autodeploy docs only document
  branch triggers. Revisit if Railway ships documented tag filters; until then
  GitHub Actions remains the release gate.
- **ALT-007: Use Docker `--target worker-runtime` for the worker service.**
  Rejected because Railway's current Dockerfile/config-as-code docs document
  Dockerfile path and start command overrides, not service-level Docker build
  target selection. Use one runtime image plus `deploy.startCommand` instead.

## 7. Future considerations (out of scope for V1)

- **FC-001: Horizontal scaling.** Add api / web replicas only when
  Railway metrics show CPU > 70% sustained for 15 minutes or P95
  latency drift. Workers scale on per-queue depth via BullMQ-Board
  (separate observability surface). The Coimbatore launch density
  (15+ active organizers, 30+ events) does not justify replicas at V1.
- **FC-002: PR-environment ephemeral deploys.** Railway's
  `environments.pr` config block + GitHub PR webhooks would give us
  per-PR preview URLs. Useful but not V1-critical and adds non-trivial
  variable-matrix complexity (each PR env needs its own Razorpay test
  account, MSG91 stub config, etc.).
- **FC-003: Multi-region deploy.** Add a second region (probably
  `us-west2` for the diaspora market) when v2 expansion happens.
  Requires moving DATABASE_URL behind a regional read replica + Redis
  cluster mode. Significant architectural shift — out of scope.
- **FC-004: Auto-rollback on healthcheck-fail.** Railway's healthcheck
  failure already prevents a bad deploy from taking traffic, but we do
  not auto-roll-back the previous deploy yet. Add a Railway webhook +
  GitHub Actions job that on `deploy.failed` calls Railway GraphQL to
  redeploy the previous commit. Phase-7+.
- **FC-005: Split api + worker images.** If worker memory pressure
  materializes (e.g. sitemap-regen or exports worker spikes RSS) split
  the images so api doesn't pay the worker's dependency surface. Track
  via Railway metrics; trigger threshold = sustained > 80% memory on
  the worker for one hour.
- **FC-006: Move Postgres + Redis off Railway.** Railway's managed PG
  is fine for V1 density but is single-region single-instance. When we
  hit V2 multi-region or need PITR + read-replicas (likely Phase 7+),
  migrate to Neon (PG) + Upstash (Redis). Both have one-line
  `DATABASE_URL` / `REDIS_URL` swap.
- **FC-007: Cloudflare in front of `apps/api`.** Currently rejected
  due to the `auth.ts` cookie-clear hook + `Cache-Control: public`
  interaction. **Pre-requisite to revisit:** rewrite the cookie-clear
  hook to either (a) only set `Set-Cookie` on responses with
  `Cache-Control: private` (and never `public`), or (b) move the
  stale-session cleanup to a per-route opt-in middleware. After that
  fix lands, putting Cloudflare in front of api would give us:
  edge-cached `/api/v1/events/by-slug/:slug`, edge-cached
  `/api/v1/sitemap.xml`, free DDoS for api, and a single perimeter for
  WAF rules. Tracked as a Phase-7+ infra slice.
- **FC-008: Railway Static Outbound IPs for third-party allowlists.**
  MSG91, Razorpay, S3/R2 don't currently require IP allowlisting. If
  any provider adds IP-based access controls (some Indian payment
  gateways do), enable Railway's [Static Outbound IPs](https://docs.railway.com/networking/static-outbound-ips)
  feature on the `api` and `worker` services so the outbound source
  address is pinned.
- **FC-009: Build-time secrets via Railway's build secrets.** Sentry
  source-map upload (`SENTRY_AUTH_TOKEN`) currently flows in via the
  build env. If we add more build-time secrets (e.g. private NPM
  registry token), use Railway's build-secret variable scope so the
  secret isn't baked into the image layers.
- **FC-010: BullMQ Board UI as a separate Railway service.** A
  read-only `bull-board` service (or `arena`) on the private network
  would give ops a queue-depth dashboard without the api carrying the
  UI weight. Cheap to add — one new service consuming the same Redis
  reference variable.

## 8. Dependencies

- **DEP-001:** Railway account, payment method, and billing cap
  configured for both projects.
- **DEP-002:** `eventkart.run` domain registered (already done per
  [docs/operations/cloudflare-cdn-setup.md](docs/operations/cloudflare-cdn-setup.md)).
- **DEP-003:** Cloudflare zone for `eventkart.run` already provisioned
  (I-2.4.1). Add `staging.eventkart.run` + `api-staging.eventkart.run`
  and `api.eventkart.run` records during Phase 4.
- **DEP-004:** GitHub repository access for Railway's GitHub App on
  both projects.
- **DEP-005:** All third-party credentials needed at runtime: MSG91
  (OTP), Razorpay (payments), S3-compatible bucket (R2 or AWS S3),
  Resend (email — Phase 3 onward), Sentry, Cloudflare API token (for
  the I-2.4.2 purge pipeline already shipped).
- **DEP-006:** Existing CI workflows ([ci.yml](.github/workflows/ci.yml),
  [migration-ci.yml](.github/workflows/migration-ci.yml)) — must continue
  to pass after Phase 1 code changes.

## 9. Files (new + modified)

**New (Phase 1):**

- `apps/web/app.config.ts` — TanStack Start server port config for Railway `PORT`
- `apps/web/src/routes/health.test.ts` — colocated health route test

**Modified (Phase 1):**

- [apps/api/src/lib/config.ts](apps/api/src/lib/config.ts) — `HOST` default
- [apps/api/.env.example](apps/api/.env.example) — explicit local `HOST=0.0.0.0`
- [apps/api/src/lib/redis.ts](apps/api/src/lib/redis.ts) — Railway private-network `family: 0`
- [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts) — direct-run guard
- [apps/api/package.json](apps/api/package.json) — `start:worker` → compiled
- [apps/web/src/routes/health.ts](apps/web/src/routes/health.ts) — add `Cache-Control: no-store`
- [apps/web/.env.example](apps/web/.env.example) — `INTERNAL_API_URL` Railway pattern
- Affected vitest cases for the above

**New (Phase 2):**

- `apps/api/Dockerfile` — multi-stage shared api + worker runtime image
- `apps/web/Dockerfile` — multi-stage with `VITE_*` ARGs
- `.dockerignore` — repo root

**New (Phase 3):**

- `railway.api.json`
- `railway.web.json`
- `railway.worker.json`

**New (Phase 5):**

- `.github/workflows/infra-ci.yml` — Railway JSON-schema validation

**Modified (Phase 5):**

- [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml) — strip migration + `railway up`, keep post-deploy health verification
- [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml) — tag-trigger Railway deploy via CLI/API, no migration step; keep manual-dispatch as emergency override

**New (Phase 7):**

- `docs/operations/railway-deployment-setup.md` — operations runbook (single source of truth)

**Modified (Phase 7):**

- [README.md](README.md) — link to new runbook
- [progress.md](progress.md) — completion row
- [docs/v1-implementation-plan.md](docs/v1-implementation-plan.md) — mark deployment infra complete

## 10. Validation matrix

After each phase:

| Phase | Validation                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `pnpm --filter api test` + `pnpm --filter web test` + `pnpm check-types` all green                                                                                                          |
| 2     | API and web `docker build` succeed locally; api image also runs the worker command override; image-size budget met; smoke `docker run` of each service hits its endpoint / logs worker boot |
| 3     | `railway.*.json` validate against the schema; `infra-ci.yml` green on PR                                                                                                                    |
| 4     | Both Railway projects exist; all documented service variables set on each environment; DNS resolves and Railway certs provision cleanly                                                     |
| 5     | CI/CD workflows pass on a no-op PR; new deploy workflow runs end-to-end on a staging push                                                                                                   |
| 6     | All 7 smoke checks (TASK-601 → TASK-607) green on staging, then on production                                                                                                               |
| 7     | Runbook reviewed; this plan archived; `progress.md` + `v1-implementation-plan.md` updated                                                                                                   |

## 11. Risk register

- **RISK-001 — `VITE_*` build-time inlining is silent on missing vars.**
  A Vite build with a missing `VITE_API_URL` will compile and ship a
  broken bundle. **Mitigation:** declare every `VITE_*` as a Dockerfile
  `ARG` (build fails loudly if missing) AND validate in
  [apps/web/src/lib/env/public.ts](apps/web/src/lib/env/public.ts) at
  module-load time (already does — it's a `@t3-oss/env-core` schema).
- **RISK-002 — Cookie-leak via shared CDN cache.** Already mitigated
  by D3 (Cloudflare in front of `web` only). Document explicitly in
  the runbook.
- **RISK-003 — Migration `preDeployCommand` failure blocks the api
  rollout but the existing api keeps serving — schema lag.** This is
  **the desired behaviour** (vs. the old GH-Actions pattern where a
  failed migration left schema ahead of code). Document the on-call
  procedure: investigate the migration failure, fix, re-deploy.
- **RISK-004 — Worker queue divergence between api (enqueueing) and
  worker (draining) on the `CLOUDFLARE_PURGE_ENABLED` boolean.** Already
  mitigated in [apps/api/src/workers/index.ts](apps/api/src/workers/index.ts)
  by re-deriving the boolean defensively to match `loadConfig`'s
  `Type.Boolean()` coercion. Verified by existing tests.
- **RISK-005 — Railway region-wide outage.** Single region for V1 is
  an accepted risk (FC-003). Mitigation: Sentry, Railway status webhooks,
  and a documented incident runbook.
- **RISK-006 — `RAILWAY_TOKEN` leak from the GH Actions emergency-
  override path.** Token is scoped per project; quarterly rotation
  documented in TASK-505. The override path is `workflow_dispatch`
  only (cannot be triggered by a malicious PR).
- **RISK-007 — Production tags cannot use Railway native autodeploy today.**
  Railway's current docs describe branch autodeploys only. Mitigation:
  keep a project-scoped `RAILWAY_TOKEN` only for the `v*` production GitHub
  Actions workflow and manual override path; staging uses tokenless Railway
  GitHub autodeploy with Wait for CI.
- **RISK-008 — `preDeployCommand` image mismatch.** A slim api runtime image
  that only contains `dist/server.js` cannot run `pnpm --filter @repo/db db:migrate:run`.
  Mitigation: Phase 2 explicitly validates the exact pre-deploy command inside
  the built api image before Railway provisioning.

---

## Task summary

Total tasks: **42** across 7 phases.

| Phase | Tasks | Goal                                |
| ----- | ----- | ----------------------------------- |
| 1     | 8     | Code-side prep (7 gap fixes)        |
| 2     | 7     | Container artifacts                 |
| 3     | 4     | Railway config-as-code              |
| 4     | 6     | Railway provisioning + DNS          |
| 5     | 5     | CI/CD wire-up                       |
| 6     | 7     | Verification (staging + production) |
| 7     | 5     | Operations runbook + plan archival  |
