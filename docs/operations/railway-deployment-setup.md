# Railway deployment setup — EventKart staging + production

> **Plan:** [docs/impl-plan/infrastructure-railway-deployment.md](../impl-plan/infrastructure-railway-deployment.md)
> **Owner:** Engineering
> **Last updated:** 2026-05-02
> **Audience:** Operators / on-call. This is a **runbook**, not application code.
> **Scope:** end-to-end Railway provisioning, env-var matrix, DNS,
> rotation cadence, rollback procedure, smoke-test commands, and cost
> guardrails for the two Railway projects that host EventKart
> (`eventkart-staging`, `eventkart-production`). The repo deliverables
> for the deployment plan are the Dockerfiles, the three `railway.*.json`
> config-as-code files, and the GitHub Actions workflows; the actual
> Railway projects + DNS records documented below are applied
> **out-of-band** by an operator with Railway and Cloudflare admin
> access — no code in this repo provisions Railway via API.

**Related runbooks:**

- [Cloudflare CDN setup](./cloudflare-cdn-setup.md) — zone, cache rules,
  WAF, and the SSR cache contract Cloudflare honours in front of `web`.
- [Infrastructure plan](../impl-plan/infrastructure-railway-deployment.md) —
  the 7-phase implementation plan this runbook closes out.

---

## 0. Prerequisites

- Railway team account with admin access to the EventKart workspace.
- Two empty Railway projects pre-created or to be created:
  - `eventkart-staging`
  - `eventkart-production`
- GitHub repo `mnishanth02/EventKart` connected to Railway via the
  Railway GitHub App (per-org install, scoped to this repo only).
- Cloudflare account with admin access to the `eventkart.run` zone (and
  the `staging.eventkart.run` subdomain delegation).
- The two `RAILWAY_TOKEN` project tokens are already stored as repo
  secrets (`RAILWAY_TOKEN_STAGING`, `RAILWAY_TOKEN_PRODUCTION`) per
  `.github/workflows/deploy-production.yml`.
- Container artifacts (`apps/api/Dockerfile`, `apps/web/Dockerfile`) and
  the three root-level `railway.*.json` config files are already merged
  to `main` (Phases 2 + 3 of the plan).
- The `infra-ci.yml` workflow validates `railway.*.json` against the
  Railway JSON schema and lints both Dockerfiles with `hadolint` on
  every PR that touches them.

---

## 1. Project topology

```text
┌──────────────────────────  Railway project: eventkart-{staging,production}  ───────────────────────┐
│                                                                                                    │
│   ┌──────────┐         private network          ┌──────────┐                                       │
│   │   web    │ ───INTERNAL_API_URL───────────►  │   api    │ ──┐                                   │
│   │ (TanStack│   http://api.railway.internal    │ (Fastify)│   │                                   │
│   │  Start)  │ ◄──Set-Cookie via PUBLIC_API_URL │          │   │ DATABASE_URL  REDIS_URL           │
│   └──────────┘                                  └──────────┘   │                                   │
│        │                                              │         ▼                                  │
│        │                                              │    ┌──────────┐    ┌──────────┐           │
│        │                                              │    │ Postgres │    │  Redis   │           │
│        │                                              │    │   17     │    │    7     │           │
│        │                                              │    └──────────┘    └──────────┘           │
│        │                                              │         ▲              ▲                  │
│        │                                              │         │              │                  │
│        │                                              │    ┌──────────┐        │                  │
│        │                                              └────│  worker  │────────┘                  │
│        │                                                   │ (BullMQ) │                           │
│        │                                                   └──────────┘                           │
│        │                                                                                          │
└────────│──────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   Cloudflare (proxy, cache, WAF) ── public users
   www.eventkart.run  →  web service
                          (api.eventkart.run is a DIRECT Railway domain;
                           no Cloudflare in front — see §1.2)
```

### 1.1 Two projects, five services each

Each Railway **project** is a self-contained environment with its own
private network, managed databases, and per-project usage cap:

| Project                | Purpose                               | GitHub trigger                                                              | Region                   |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `eventkart-staging`    | Pre-production verification on `main` | Railway native autodeploy + "Wait for CI" on `main`                         | `asia-southeast1-eqsg3a` |
| `eventkart-production` | Live traffic from `eventkart.run`     | GitHub Actions on `v*` tag push (`.github/workflows/deploy-production.yml`) | `asia-southeast1-eqsg3a` |

Each project hosts the same five services:

| Service    | Type                | Image source          | Public domain (per project)                                         |
| ---------- | ------------------- | --------------------- | ------------------------------------------------------------------- |
| `postgres` | Managed Postgres 17 | Railway template      | private only (`${{Postgres.DATABASE_URL}}`)                         |
| `redis`    | Managed Redis 7     | Railway template      | private only (`${{Redis.REDIS_URL}}`)                               |
| `api`      | Fastify v5          | `apps/api/Dockerfile` | `api-staging.eventkart.run` / `api.eventkart.run`                   |
| `web`      | TanStack Start      | `apps/web/Dockerfile` | `staging.eventkart.run` / `eventkart.run` (and `www.eventkart.run`) |
| `worker`   | BullMQ workers      | `apps/api/Dockerfile` | private only (no public domain)                                     |

The `worker` service shares the **same Docker image** as `api` (per
[CON-002](../impl-plan/infrastructure-railway-deployment.md)) and only
overrides the `startCommand` to boot `dist/workers/index.js` instead of
`dist/server.js`.

**Region:** Singapore (`asia-southeast1-eqsg3a`) — closest Railway POP
to the Coimbatore launch market, ~30–60 ms RTT vs 250+ ms from US
regions. All five services in both projects MUST be provisioned in this
region. Mixing regions inside a project breaks private networking
(`*.railway.internal` only resolves within a single region).

### 1.2 Cloudflare in front of `web` only — DO NOT change without reading this

Cloudflare proxies **only the `web` service** (`eventkart.run`,
`www.eventkart.run`, `staging.eventkart.run`). The `api` service is
reached **directly** at the Railway-issued domain (`api.eventkart.run`,
`api-staging.eventkart.run`) with Cloudflare set to **DNS-only**
(grey-cloud) for those records.

**Why:** the global `onRequest` cookie-clear hook in
[`apps/api/src/plugins/auth.ts`](../../apps/api/src/plugins/auth.ts)
writes `Set-Cookie` on every response. If a shared CDN cache ever sat
in front of `apps/api` and a `Cache-Control: public` response slipped
through (e.g. `/health`, `/api/v1/sitemap.xml`, or a misconfigured
public route), Cloudflare could serve user A's `Set-Cookie` to user B.
Keeping the API off Cloudflare eliminates that confused-deputy class of
bug entirely. The Cloudflare cache contract (see
[cloudflare-cdn-setup.md §6](./cloudflare-cdn-setup.md#6-cache-contract-the-bytes-cloudflare-sees))
deliberately omits `Vary: Cookie` on `/events/*` and `/organizers/*` —
that contract is only safe because the routes the contract applies to
are auth-free, and the API (which is NOT auth-free) is not behind the
same CDN.

Before "fixing" this by routing `apps/api` through Cloudflare, read
[memory: cache security] and the `auth.ts` cookie-clear hook in
context. The current architecture is the mitigation, not the bug.

---

## 2. Service config (config-as-code)

The repo ships three Railway config files at the **repo root**. Per
[Railway's monorepo doc](https://docs.railway.com/deployments/monorepo)
the Railway Config File Path "does not follow the Root Directory" — so
each service's dashboard "Config File Path" must point to the
root-level file explicitly (e.g. `/railway.api.json`, NOT
`apps/api/railway.json`).

| Service  | Config file (dashboard "Config File Path") | Dockerfile            | startCommand                              | healthcheckPath | drainingSeconds | overlapSeconds | preDeployCommand                        |
| -------- | ------------------------------------------ | --------------------- | ----------------------------------------- | --------------- | --------------- | -------------- | --------------------------------------- |
| `api`    | `/railway.api.json`                        | `apps/api/Dockerfile` | `node --import tsx dist/server.js`        | `/health`       | 30              | 30             | `pnpm --filter @repo/db db:migrate:run` |
| `web`    | `/railway.web.json`                        | `apps/web/Dockerfile` | `node .output/server/index.mjs`           | `/health`       | 30              | 30             | —                                       |
| `worker` | `/railway.worker.json`                     | `apps/api/Dockerfile` | `node --import tsx dist/workers/index.js` | _(none)_        | 60              | 0              | —                                       |

### 2.1 startCommand ↔ Dockerfile WORKDIR contract

The startCommand is **executed relative to the Dockerfile's final-stage
`WORKDIR`** — so they MUST be coordinated:

| Service  | Dockerfile final WORKDIR | startCommand path resolves to                            |
| -------- | ------------------------ | -------------------------------------------------------- |
| `api`    | `/app/apps/api`          | `/app/apps/api/dist/server.js` (loaded via tsx)          |
| `web`    | `/app`                   | `/app/.output/server/index.mjs`                          |
| `worker` | `/app/apps/api`          | `/app/apps/api/dist/workers/index.js` (loaded via tsx)   |

If you ever change a Dockerfile's `WORKDIR`, update the matching
`railway.*.json` `startCommand` **in the same PR**. The `infra-ci.yml`
workflow validates schema only — it cannot catch a path-mismatch that
the Dockerfile produces but the startCommand assumes is somewhere else.

### 2.1.1 Why `node --import tsx` and not plain `node`

Both api and worker start commands load the compiled api with
`node --import tsx`. The compiled `dist/server.js` imports `@repo/db`
and `@repo/shared`, which export their TypeScript source directly via
their `package.json` `exports` fields (e.g. `"./schemas":
"./src/schemas/index.ts"`). When those `.ts` files use a `./foo.js`
specifier internally (the standard ESM-with-TS convention), plain
`node` cannot rewrite the `.js` extension to `.ts` and module
resolution fails.

`tsx` registers an ESM loader that handles this rewriting, so
`node --import tsx dist/server.js` resolves the imports correctly.
`tsx` is installed globally in the api runtime image (see
`apps/api/Dockerfile` runtime stage) and resolves from any cwd. The
performance overhead is negligible at module-load and zero in the
request-handling hot path (tsx caches transformations).

If the runtime workspace packages are ever migrated to a compiled
`dist/*.js` output (with `package.json` exports updated to point at
`dist`), the `--import tsx` flag can be dropped from both
`startCommand` values and the `apps/api/Dockerfile` `CMD` — that
cleanup is tracked as a follow-up.

### 2.2 Why no healthcheck on `worker`

The `worker` service has **no `healthcheckPath`**. Railway treats
no-healthcheck services as healthy as long as the process is up; the
BullMQ workers self-report liveness through the existing OTEL/Pino
metrics in I-0.4.6. A naive HTTP healthcheck would force the worker
process to also bind a port (extra surface area, extra failure mode)
without improving signal — BullMQ stalled-job detection is the right
healthcheck for a worker.

### 2.3 Why `overlapSeconds=0` on `worker`

`overlapSeconds` keeps the old replica running for N seconds after the
new replica passes its healthcheck. For `api` and `web` this gives
zero-downtime cutover (in-flight HTTP requests drain on the old pod
while new requests hit the new pod). For `worker` this is **dangerous**
— two workers on the same BullMQ queues could race on the same job and
process it twice. The 60s `drainingSeconds` is the SIGTERM grace window
for in-flight jobs to finish; `overlapSeconds=0` ensures the new worker
only starts after the old worker has fully exited.

### 2.4 Why `preDeployCommand` only on `api`

Migrations run on the `api` service's pre-deploy pass, in a separate
container that boots the production image with private-network access
to `${{Postgres.DATABASE_URL}}`. Railway blocks the deploy if
`pnpm --filter @repo/db db:migrate:run` exits non-zero — so a broken
migration leaves the **previous** api code running against the
**previous** schema (the desired safe state). See
[RISK-003](../impl-plan/infrastructure-railway-deployment.md) and §6
below for the fix-and-redeploy procedure.

The `web` and `worker` services do not run migrations — Drizzle is
single-writer and the api image owns the schema lifecycle.

---

## 3. Environment variable matrix

This is the source of truth for every variable on every service in
both environments. **Set every variable** before triggering the first
deploy of each service — Railway will boot a service with missing env
vars and the failure mode (Vite inlines `undefined`, Fastify
`loadConfig` throws on schema mismatch) is much harder to debug after
the fact.

Legend:

- **B** = build-time (must be present when the Docker image builds)
- **R** = runtime (must be present when the container starts)
- **secret** = mark as Railway "secret" so it is masked in logs
- `${{X}}` = Railway reference variable (resolved at deploy time)

### 3.1 `api` service

All variables are **runtime**. The api Dockerfile has no `VITE_*` ARGs.

| Variable                               | Type      | Staging value                                          | Production value                                | Notes                                                                                                                 |
| -------------------------------------- | --------- | ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                             | R         | `production`                                           | `production`                                    | Always `production` on Railway, even on staging.                                                                      |
| `HOST`                                 | R         | `::`                                                   | `::`                                            | Railway dual-stack bind. See [TASK-101].                                                                              |
| `PORT`                                 | R         | `3001`                                                 | `3001`                                          | Explicit so private-network URL is deterministic.                                                                     |
| `LOG_LEVEL`                            | R         | `debug`                                                | `info`                                          | Pino level. `debug` on staging surfaces SQL + plugin lifecycle.                                                       |
| `LOG_PRETTY`                           | R         | `false`                                                | `false`                                         | Always JSON in production for log aggregation.                                                                        |
| `WEB_ORIGIN`                           | R         | `https://staging.eventkart.run`                        | `https://eventkart.run`                         | CORS allowlist + cookie domain calculation.                                                                           |
| `DATABASE_URL`                         | R         | `${{Postgres.DATABASE_URL}}`                           | `${{Postgres.DATABASE_URL}}`                    | Railway reference. No PgBouncer in path → safe for migrations too.                                                    |
| `REDIS_URL`                            | R         | `${{Redis.REDIS_URL}}`                                 | `${{Redis.REDIS_URL}}`                          | Railway reference. ioredis `family: 0` set in code.                                                                   |
| `INTERNAL_API_KEY`                     | R, secret | `<random 32-byte hex>`                                 | `<random 32-byte hex>` (different from staging) | Shared with `web` service in same project. See §5 for swap.                                                           |
| `OTP_DELIVERY_MODE`                    | R         | `msg91`                                                | `msg91`                                         | `dev-log` only on local docker-compose.                                                                               |
| `OTP_HMAC_SECRET`                      | R, secret | `<random 32-byte hex>`                                 | `<random 32-byte hex>`                          | Hashes OTPs in Redis. Quarterly rotation.                                                                             |
| `CSRF_SECRET`                          | R, secret | `<random 32-byte hex>`                                 | `<random 32-byte hex>`                          | HMAC for double-submit CSRF cookie. Quarterly rotation.                                                               |
| `COOKIE_DOMAIN`                        | R         | `.staging.eventkart.run` _(if cross-subdomain needed)_ | `.eventkart.run`                                | Leading dot enables `api.*` ↔ `*` cookie sharing.                                                                     |
| `MSG91_AUTH_KEY`                       | R, secret | `<MSG91 staging auth key>`                             | `<MSG91 production auth key>`                   | OTP send. Quarterly rotation.                                                                                         |
| `MSG91_OTP_TEMPLATE_ID`                | R         | `<MSG91 staging template id>`                          | `<MSG91 production template id>`                | Approved DLT template.                                                                                                |
| `RAZORPAY_KEY_ID`                      | R, secret | `rzp_test_<...>`                                       | `rzp_live_<...>`                                | Annual rotation (or per Razorpay recommendation).                                                                     |
| `RAZORPAY_KEY_SECRET`                  | R, secret | `<staging secret>`                                     | `<production secret>`                           | Annual rotation.                                                                                                      |
| `RAZORPAY_WEBHOOK_SECRET`              | R, secret | `<staging webhook secret>`                             | `<production webhook secret>`                   | Verifies `X-Razorpay-Signature` HMAC on inbound webhooks.                                                             |
| `RESEND_API_KEY`                       | R, secret | `<Resend staging key>`                                 | `<Resend production key>`                       | Email send. Annual rotation.                                                                                          |
| `EMAIL_FROM`                           | R         | `EventKart <noreply@staging.eventkart.run>`            | `EventKart <noreply@eventkart.run>`             | Must match a verified Resend sender.                                                                                  |
| `S3_ENDPOINT`                          | R         | `https://<r2-account>.r2.cloudflarestorage.com`        | same (or different bucket-tenant)               | Cloudflare R2 endpoint.                                                                                               |
| `S3_REGION`                            | R         | `auto`                                                 | `auto`                                          | R2 ignores region but the SDK requires the value.                                                                     |
| `S3_ACCESS_KEY_ID`                     | R, secret | `<R2 staging key id>`                                  | `<R2 production key id>`                        | On-demand rotation.                                                                                                   |
| `S3_SECRET_ACCESS_KEY`                 | R, secret | `<R2 staging secret>`                                  | `<R2 production secret>`                        | On-demand rotation.                                                                                                   |
| `S3_BUCKET`                            | R         | `eventkart-staging`                                    | `eventkart-production`                          | Separate buckets per environment.                                                                                     |
| `S3_FORCE_PATH_STYLE`                  | R         | `true`                                                 | `true`                                          | R2 requires path-style addressing.                                                                                    |
| `CLOUDFLARE_PURGE_ENABLED`             | R         | `false`                                                | `true`                                          | Staging skips purges (no Cloudflare zone for `*.staging.*` cache).                                                    |
| `CLOUDFLARE_ZONE_ID`                   | R         | `<staging zone id or empty>`                           | `<production eventkart.run zone id>`            | Required when purge enabled.                                                                                          |
| `CLOUDFLARE_API_TOKEN`                 | R, secret | `<scoped token or empty>`                              | `<scoped Zone — Cache Purge token>`             | Quarterly rotation. See [cloudflare-cdn-setup.md §5](./cloudflare-cdn-setup.md#5-cloudflare-api-token-used-by-i-242). |
| `CDN_BASE_URL`                         | R         | `https://staging.eventkart.run`                        | `https://eventkart.run`                         | Used by purge URL builder.                                                                                            |
| `ADMIN_IP_ALLOWLIST`                   | R         | _(empty or office IPs)_                                | `<comma-separated /32 or /28 CIDRs>`            | Optional — restricts `/api/v1/admin/*` source IPs.                                                                    |
| `SENTRY_DSN`                           | R         | `<Sentry staging DSN>`                                 | `<Sentry production DSN>`                       | Different projects per env.                                                                                           |
| `SENTRY_ENVIRONMENT`                   | R         | `staging`                                              | `production`                                    | Drives Sentry environment tag.                                                                                        |
| `SENTRY_RELEASE`                       | R         | `<git sha>`                                            | `<git tag, e.g. v0.1.0>`                        | Set by deploy workflow at boot or via Railway build env.                                                              |
| `SENTRY_TRACES_SAMPLE_RATE`            | R         | `1.0`                                                  | `0.1`                                           | Full sampling on staging; 10% on prod.                                                                                |
| `OTEL_SERVICE_NAME`                    | R         | `eventkart-api`                                        | `eventkart-api`                                 | OTEL service.name resource attribute.                                                                                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT`          | R         | `<staging OTLP collector URL>`                         | `<production OTLP collector URL>`               | Optional — leave unset to disable OTEL export.                                                                        |
| `OTEL_EXPORTER_OTLP_HEADERS`           | R, secret | `<auth headers if needed>`                             | `<auth headers if needed>`                      | E.g. `Authorization=Bearer ...` for hosted collectors.                                                                |
| `OTEL_METRICS_EXPORT_INTERVAL_MS`      | R         | `30000`                                                | `30000`                                         | 30s metric export cadence.                                                                                            |
| `PUBLIC_SPOTS_REMAINING_BADGE_ENABLED` | R         | `false`                                                | `false`                                         | Stays `false` until I-3.2.10 atomic decrement ships.                                                                  |

### 3.2 `web` service

The web service has **two layers** of variables:

- **Build-time (`VITE_*` + `SENTRY_AUTH_TOKEN`):** must be passed as
  Railway service variables AND declared as Docker build args in
  Railway's UI ("Build Args" section under each service's Settings).
  These are inlined into the client bundle at `vite build` and CANNOT
  change at runtime — a value rotation requires a rebuild.
- **Runtime (server-only):** read by Nitro on container start.

**Reminder:** `VITE_*` values are public — anything you put there ships
to every browser. NEVER put a secret behind a `VITE_*` prefix.

#### 3.2.1 `web` build-time (Docker `ARG`)

| Variable                                    | Type      | Staging value                       | Production value              | Notes                                                                         |
| ------------------------------------------- | --------- | ----------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `VITE_APP_TITLE`                            | B         | `EventKart`                         | `EventKart`                   |                                                                               |
| `VITE_API_URL`                              | B         | `https://api-staging.eventkart.run` | `https://api.eventkart.run`   | Used by browser fetches. Different host than `INTERNAL_API_URL`.              |
| `VITE_SITE_URL`                             | B         | `https://staging.eventkart.run`     | `https://eventkart.run`       | Canonical origin used in OG tags + SEO.                                       |
| `VITE_POSTHOG_KEY`                          | B         | _(optional)_                        | _(optional)_                  | Leave empty to disable PostHog instrumentation.                               |
| `VITE_POSTHOG_HOST`                         | B         | `https://us.i.posthog.com`          | `https://us.i.posthog.com`    |                                                                               |
| `VITE_PUBLIC_SUPPORT_PHONE`                 | B         | _(optional, e.g. `+919876543210`)_  | _(optional, support hotline)_ | Drives `getSupportPhone()` on `/contact`.                                     |
| `VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED` | B         | `false`                             | `false`                       | Mirror the api flag; flip both atomically when I-3.2.10 ships.                |
| `VITE_SENTRY_DSN`                           | B         | `<Sentry web staging DSN>`          | `<Sentry web production DSN>` | Browser-side Sentry. Separate from `SENTRY_DSN` (server-side).                |
| `VITE_SENTRY_ENVIRONMENT`                   | B         | `staging`                           | `production`                  |                                                                               |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`            | B         | `1.0`                               | `0.1`                         |                                                                               |
| `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`   | B         | `0.1`                               | `0.01`                        | 1% session replay in prod is the privacy-conscious default.                   |
| `SENTRY_AUTH_TOKEN`                         | B, secret | `<Sentry CLI token>`                | `<Sentry CLI token>`          | Source-map upload at build. On-demand rotation if a CI runner is compromised. |
| `SENTRY_ORG`                                | B         | `<sentry org slug>`                 | `<sentry org slug>`           |                                                                               |
| `SENTRY_PROJECT`                            | B         | `eventkart-web`                     | `eventkart-web`               |                                                                               |

**RISK-001 reminder:** missing `VITE_*` values do NOT fail the Vite
build — they inline as `undefined`. The `apps/web/Dockerfile` ARG
declarations make missing args fail loudly at `docker build`, and
[`apps/web/src/lib/env/public.ts`](../../apps/web/src/lib/env/public.ts)
uses `@t3-oss/env-core` to validate at module load. Do not bypass either.

#### 3.2.2 `web` runtime

| Variable                    | Type      | Staging value                                         | Production value                              | Notes                                                                       |
| --------------------------- | --------- | ----------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                  | R         | `production`                                          | `production`                                  |                                                                             |
| `PORT`                      | R         | `3000`                                                | `3000`                                        | Nitro reads `process.env.PORT`. Explicit so healthchecks are deterministic. |
| `INTERNAL_API_URL`          | R         | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001`         | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` | Railway private network. Equivalent to `http://api.railway.internal:3001`.  |
| `INTERNAL_API_KEY`          | R, secret | _(matches api `INTERNAL_API_KEY`)_                    | _(matches api `INTERNAL_API_KEY`)_            | Set the **same value** as on the api service in the same project.           |
| `SERVER_URL`                | R         | `https://staging.eventkart.run`                       | `https://eventkart.run`                       | Used by SSR for absolute URL generation.                                    |
| `SENTRY_DSN`                | R         | `<Sentry web server-side DSN, can equal browser DSN>` | _(same)_                                      | Server-side error capture during SSR.                                       |
| `SENTRY_ENVIRONMENT`        | R         | `staging`                                             | `production`                                  |                                                                             |
| `SENTRY_TRACES_SAMPLE_RATE` | R         | `1.0`                                                 | `0.1`                                         |                                                                             |

### 3.3 `worker` service

Same image as `api`, same DB/Redis/secret bag, but **no HTTP listener
variables** and **no api-specific public-facing toggles**. Anything not
listed here is intentionally absent.

| Variable                                                                                       | Required | Notes                                                     |
| ---------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `NODE_ENV`                                                                                     | yes      | `production`                                              |
| `LOG_LEVEL`                                                                                    | yes      | `debug` (staging) / `info` (prod)                         |
| `LOG_PRETTY`                                                                                   | yes      | `false`                                                   |
| `DATABASE_URL`                                                                                 | yes      | `${{Postgres.DATABASE_URL}}`                              |
| `REDIS_URL`                                                                                    | yes      | `${{Redis.REDIS_URL}}`                                    |
| `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`                                                      | yes      | OTP-related queues (e.g. retry sends) need MSG91 access.  |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                            | yes      | `payment-webhook` queue verifies and reconciles.          |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                                 | yes      | `email` queue.                                            |
| `S3_*` (all six)                                                                               | yes      | `exports`, `cleanup` (KYC doc deletion).                  |
| `CLOUDFLARE_PURGE_ENABLED`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`, `CDN_BASE_URL`       | yes      | `cdn-purge` queue.                                        |
| `OTP_HMAC_SECRET`                                                                              | yes      | `cleanup` queue scrubs OTP hashes after retention window. |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`              | yes      | Same shape as api.                                        |
| `OTEL_SERVICE_NAME`                                                                            | yes      | `eventkart-worker` (DIFFERENT from api).                  |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_METRICS_EXPORT_INTERVAL_MS` | optional | Same as api when set.                                     |

**Explicitly absent on `worker`:**

- `HOST`, `PORT` — no HTTP listener.
- `WEB_ORIGIN` — no CORS surface.
- `INTERNAL_API_KEY` — workers never serve internal HTTP.
- `CSRF_SECRET` — no cookies issued.
- `ADMIN_IP_ALLOWLIST` — no admin HTTP routes.
- `PUBLIC_SPOTS_REMAINING_BADGE_ENABLED` — render-side feature flag.

---

## 4. DNS records

Records are added in the Cloudflare dashboard for the `eventkart.run`
zone. Railway auto-provisions a Let's Encrypt cert per custom domain
once the CNAME resolves; verify each cert lands cleanly before
declaring the record done.

| Record                      | Type    | Target                                  | Cloudflare proxy | Notes                                                                                                                        |
| --------------------------- | ------- | --------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `staging.eventkart.run`     | `CNAME` | Railway-provided staging web domain     | 🟠 **Proxied**   | `web` service in `eventkart-staging`. Cloudflare cache rules apply per [cloudflare-cdn-setup.md](./cloudflare-cdn-setup.md). |
| `api-staging.eventkart.run` | `CNAME` | Railway-provided staging api domain     | ⚫ **DNS only**  | `api` service in `eventkart-staging`. NO proxy — see §1.2.                                                                   |
| `eventkart.run` (apex)      | `CNAME` | Railway-provided production web domain  | 🟠 **Proxied**   | Cloudflare CNAME flattening (free plan and above). `web` service in `eventkart-production`.                                  |
| `www.eventkart.run`         | `CNAME` | `eventkart.run` (or Railway web domain) | 🟠 **Proxied**   | Cloudflare page rule below 301-redirects `www` → apex (handled in cloudflare-cdn-setup.md).                                  |
| `api.eventkart.run`         | `CNAME` | Railway-provided production api domain  | ⚫ **DNS only**  | `api` service in `eventkart-production`. NO proxy — see §1.2.                                                                |

### 4.1 Validation per record

After each CNAME goes live in Cloudflare:

1. **DNS resolves:** `nslookup staging.eventkart.run 1.1.1.1` returns
   the Railway target (or, for proxied records, Cloudflare proxy IPs in
   the `104.16.x` / `172.67.x` range).
2. **Railway recognises the domain:** Railway dashboard → service →
   Settings → Public Networking shows the custom domain with a green
   "Active" badge.
3. **Cert is provisioned:** within 1–5 minutes of the CNAME going live
   Railway issues a Let's Encrypt cert. The dashboard shows "TLS:
   Active" on the custom domain row.
4. **HTTPS works:** `curl -I https://<domain>/health` returns `200`
   with a valid cert chain (no `--insecure` needed).

If the cert sits "Provisioning" for >10 minutes, the most common cause
is that the CNAME points at the wrong Railway service or the previous
domain owner left a CAA record blocking Let's Encrypt. Check
`dig CAA eventkart.run` first, then re-verify the CNAME target.

### 4.2 What is NOT in this table

- Email DNS (SPF / DKIM / DMARC for `eventkart.run`) — owned by the
  messaging module setup, see Resend/SES onboarding docs.
- `status.eventkart.run` — owned by the status-page provider runbook
  (see [cloudflare-cdn-setup.md §1](./cloudflare-cdn-setup.md#1-dns-records)
  for the convention: status pages stay DNS-only so they remain
  reachable when Cloudflare itself has issues).
- Internal `*.railway.internal` — Railway-managed, never appears in
  Cloudflare.

---

## 5. Secret rotation cadence

A scheduled rotation is the difference between "we rotate quarterly"
and "we rotate when something leaks." Each row owns its own runbook;
the platform on-call holds the calendar reminder.

### 5.1 Quarterly rotation (every 90 days)

| Secret                                               | Rotation method                                                                                                              | Coordination                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `RAILWAY_TOKEN_STAGING` / `RAILWAY_TOKEN_PRODUCTION` | Railway dashboard → Project → Tokens → Revoke + Regenerate. Update GitHub repo secrets in the same commit.                   | None — affects CI only.                                               |
| `CLOUDFLARE_API_TOKEN`                               | Cloudflare dashboard. Full procedure in [cloudflare-cdn-setup.md §5.2](./cloudflare-cdn-setup.md#52-token-rotation-runbook). | Per-environment (staging + production tokens are independent).        |
| `MSG91_AUTH_KEY`                                     | MSG91 portal → Profile → Auth Keys → Regenerate. Update Railway variables on `api` + `worker`.                               | Coordinated swap on api + worker (same value).                        |
| `OTP_HMAC_SECRET`                                    | Generate `openssl rand -hex 32`. Replace on api + worker. Existing in-flight OTPs become invalid → users will re-request.    | Coordinated swap on api + worker. Schedule during low-traffic window. |
| `CSRF_SECRET`                                        | Generate `openssl rand -hex 32`. Replace on api only. Active sessions stay valid (cookie HMAC re-signed on next request).    | api only. No coordination needed.                                     |
| `INTERNAL_API_KEY`                                   | Generate `openssl rand -hex 32`. **Atomic two-step swap** (see §5.4 below).                                                  | Coordinated swap on api + web.                                        |

### 5.2 Annual rotation

| Secret                                    | Rotation method                                                                            | Coordination  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard. Or per Razorpay's recommended cadence — they may push rotations.       | api + worker. |
| `RAZORPAY_WEBHOOK_SECRET`                 | Razorpay dashboard → Webhooks → Edit → Regenerate Secret. Update Razorpay endpoint config. | api only.     |
| `RESEND_API_KEY`                          | Resend dashboard → API Keys → Regenerate.                                                  | api + worker. |

### 5.3 On-demand only

| Secret                                      | Trigger                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`                         | A CI runner is compromised, or a token is shown in a screenshare/screenshot.     |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | A key is leaked, or the R2 access pattern changes (e.g. new IAM scoping).        |
| `SENTRY_DSN`                                | DSN should never need rotation; replace only if the Sentry project is recreated. |

### 5.4 `INTERNAL_API_KEY` two-step swap (atomic)

The `requireInternal` preHandler on the api service rejects any request
whose `X-Internal-Key` does not match `config.INTERNAL_API_KEY`. If you
rotate one side ahead of the other, every SSR server-function call
fails until the other side catches up. The procedure:

1. **Stage the new value on `api` first.** Some api routes also accept
   the **previous** `INTERNAL_API_KEY` for a short grace window; today
   the simpler flow is: set `INTERNAL_API_KEY=<new>` on `api`, redeploy
   `api`, and accept that web → api calls 401 for the ~30 second
   overlap window (web still sends the old key) — these are safe to
   retry and the SSR loaders will retry on the next page hit.
2. **Update `web` to the new value.** Set `INTERNAL_API_KEY=<new>` on
   `web`, redeploy `web`. After web finishes rolling out the system is
   fully back to baseline.
3. **Verify** by curling `https://staging.eventkart.run/` (any SSR
   page) and confirming no 5xx surge in Sentry over the next 5 minutes.

For a true zero-downtime swap, future work could land a
`INTERNAL_API_KEY_PREVIOUS` slot on the api side that accepts both
values for a configured grace window. Until then, the staging swap
above is verified to work; production swaps should use the same
procedure during a low-traffic window.

### 5.5 General rotation procedure (non-coordinated)

For any single-service secret (e.g. `MSG91_AUTH_KEY` on api alone):

1. Generate the new value via the source-of-truth dashboard
   (MSG91, Razorpay, etc.).
2. Test the new value out-of-band (e.g. send a test OTP from the
   MSG91 portal) before touching Railway.
3. Railway dashboard → Project → Service → Variables → click the
   variable → paste the new value → Save. Railway triggers a redeploy
   automatically.
4. Wait for the redeploy to complete (`Deployments` tab shows the new
   build as `Active`).
5. Smoke test the dependent code path (e.g. trigger an OTP send via
   the staging UI).
6. Revoke the old value at the source-of-truth dashboard. Never leave
   two valid values active beyond the redeploy window — the old value
   becomes a long-lived secret with no rotation owner.
7. Record the rotation in the platform audit log (manual entry until
   the Phase 7 audit module covers infra).

---

## 6. Rollback procedure

Three flavours of rollback. Pick the right one for the symptom.

### 6.1 Code rollback (no schema change)

Use this when a deploy ships a bug that the schema can tolerate
(typical for UI bugs, copy errors, non-schema API regressions).

**Via Railway dashboard:**

1. Railway → Project → service (`api` or `web` or `worker`) → Deployments.
2. Identify the last known-good deployment (look for the `v0.x.y` tag
   on production, or the previous green deploy on staging).
3. Click the deployment → "Redeploy" (top-right).
4. Railway re-runs the same image with the same env vars. No
   migrations re-run; this is purely a code revert.
5. Verify with the smoke-test curls in §7 below.

**Via CLI (in CI or from a workstation):**

```sh
railway redeploy --service api --deployment <previous-deployment-id> \
  --environment production
```

The Railway CLI emits the deployment id in the success line of every
`railway up`. You can also list them with:

```sh
railway deployments list --service api --environment production
```

### 6.2 Schema rollback

Use this when the failure is caused by the new schema (rare, because
expand/contract migrations are reviewed for backward compatibility in
PR — see `db:check:rollbacks` in `migration-ci.yml`).

1. **Identify the bad migration** in the api deploy logs. Drizzle
   migration runner logs `Running migration NNNN_<name>.sql` lines.
2. **Locate the rollback file** in
   [`packages/db/scripts/`](../../packages/db/scripts/) — every forward
   migration has a paired rollback validated by the
   `migration-ci.yml` job.
3. **Apply the rollback against `DATABASE_URL`.** Railway managed
   Postgres has no PgBouncer in the connection path, so the same
   `DATABASE_URL` you set on the service works for the migration tool.
   From a workstation with `MIGRATION_DATABASE_URL` set to the
   production connection string:

   ```sh
   pnpm --filter @repo/db db:rollback:run --to <previous-migration-name>
   ```

   Or, if you only need to roll back the most recent migration:

   ```sh
   pnpm --filter @repo/db db:rollback:run --steps 1
   ```

   _(The exact CLI flags live in `packages/db/scripts/rollback.ts` —
   confirm before running.)_

4. **Rollback the api code** via §6.1 to a deploy whose image matches
   the now-current schema.
5. **Verify** with `pnpm --filter @repo/db db:status` (or the equivalent
   `drizzle-kit introspect:pg` diff) that the live schema matches the
   target migration.

### 6.3 Hot-fix path (production)

Use this when neither §6.1 nor §6.2 fully resolves the symptom and you
need a forward-fix faster than a code rollback would settle.

1. Branch off the `v0.x.y` tag that's currently live in production:

   ```sh
   git checkout -b hotfix/v0.x.y-1 v0.x.y
   git cherry-pick <fix-commit>
   git push origin hotfix/v0.x.y-1
   ```

2. Open a PR into `main`, fast-track review.
3. Tag the merge commit `v0.x.y-hotfix1` and push the tag:

   ```sh
   git tag v0.x.y-hotfix1
   git push origin v0.x.y-hotfix1
   ```

4. The `deploy-production.yml` workflow takes over from the tag push
   and rolls out api + web + worker in the existing order.

The `workflow_dispatch` path in `deploy-production.yml` (with the
`confirm: yes` gate) is also available as an emergency override if the
tag-trigger path is blocked for any reason.

---

## 7. Smoke-test commands

Run all of these after every significant deploy (any deploy that
touches more than one service, or any production deploy). Save the
output in the deploy ticket so the next on-call can diff against a
known baseline.

### 7.1 Staging — TASK-601 through TASK-604

```bash
# TASK-601a: API liveness — process up, no DB hit
curl https://api-staging.eventkart.run/health
# Expected: 200 {"status":"ok"}

# TASK-601b: API readiness — Postgres + Redis pings
curl https://api-staging.eventkart.run/ready
# Expected: 200
# Body: { status: "ok", postgres: "ok", redis: "ok", uptime: <seconds> }

# TASK-602a: Web liveness — process up, no upstream calls
curl -i https://staging.eventkart.run/health
# Expected: 200 {"status":"ok"}
# Headers: Cache-Control: no-store

# TASK-602b: Public event detail — CDN cache contract
curl -I https://staging.eventkart.run/events/<known-slug>
# Expected: 200
# Headers: Cache-Control: public, s-maxage=60, stale-while-revalidate=300
#          CF-Cache-Status: MISS  (on first call)
#
# Run the same curl again within 60s:
curl -I https://staging.eventkart.run/events/<known-slug>
# Expected: 200
#          CF-Cache-Status: HIT   (transition MISS → HIT proves the cache rule fires)

# TASK-603: Sitemap — routed by web → api per I-2.4.4
curl https://staging.eventkart.run/sitemap.xml
# Expected: valid XML, content-type: application/xml; charset=utf-8

# TASK-604: Worker boot logs
railway logs --service worker --environment staging --deployment <latest-id>
# Expected within ~10s of boot:
#   "Workers started: payment-webhook, email, cleanup, exports, cdn-purge,
#    razorpay-account, sitemap-regen"
#   "Sitemap-regen cron registered: 0 3 * * *"  (or the configured cadence)
```

### 7.2 Production — repeat after the first `v0.1.0` tag

```bash
curl https://api.eventkart.run/health
curl https://api.eventkart.run/ready
curl -i https://eventkart.run/health
curl -I https://eventkart.run/events/<known-slug>     # twice — MISS → HIT
curl https://eventkart.run/sitemap.xml
railway logs --service worker --environment production --deployment <latest-id>
```

### 7.3 End-to-end (manual, post-smoke)

These are not automatable from CI but are part of TASK-604 / TASK-606:

1. Sign in to the staging organizer dashboard with a test phone number.
2. Publish a test event.
3. Verify within 60 seconds:
   - The new event slug appears in `https://staging.eventkart.run/sitemap.xml`.
   - Worker logs show one `cdn-purge` job and one `sitemap-regen` job
     completed successfully.
   - The event detail page renders at the public URL.
4. Unpublish the event. Verify the inverse (event removed from
   sitemap, public URL returns the soft-404 layout).

---

## 8. Cost guardrails

Railway bills usage-based. Without a cap, a runaway loop (worker
crash-restart, infinite sitemap regen, etc.) can burn through budget
in hours. Set Project Usage caps **before** the first deploy.

### 8.1 Caps at launch (TASK-406)

| Project                | Initial cap (USD/month) | Rationale                                                             |
| ---------------------- | ----------------------- | --------------------------------------------------------------------- |
| `eventkart-staging`    | **$50**                 | 5 services × 0.25–0.5 GB RAM × 24h ≈ ~$30 baseline; $50 leaves slack. |
| `eventkart-production` | **$200**                | Coimbatore launch density. Re-baseline after the first 30 days.       |

Adjust both caps after the first 30 days based on the actual usage
graph. The cap is a hard ceiling: when reached, Railway suspends
billing-eligible deployments.

### 8.2 Set the cap

Railway dashboard → Project → Settings → **Project Usage Limit** →
enter the amount → Save. Apply on **both** projects.

### 8.3 Configure alerts

Railway dashboard → Project → Settings → **Notifications**:

- **80% of cap reached** → email to platform on-call.
- **100% of cap reached** → email + PagerDuty (or equivalent) to
  platform on-call.

Treat 80% as a soft warning ("review usage this week") and 100% as a
P1 ("services suspending unless we raise the cap or stop the
runaway"). The cap is intentionally low at launch — we'd rather get
woken up by Railway than by a surprise invoice.

### 8.4 What's not capped here

- Cloudflare R2 egress / requests (covered by Cloudflare's own billing
  alerts, separate dashboard).
- MSG91 OTP sends (covered by MSG91's own credit balance + alerts).
- Razorpay transaction fees (per-transaction, no cap to set).
- Resend email sends (covered by Resend's own monthly quota).

Each of those has its own bill and its own alert cadence — not Railway's
problem.

---

## Appendix A — Provisioning checklist

A quick reference for the first deploy of each environment. Maps
directly onto Phase 4 of the plan (TASK-401 through TASK-406).

**Per project (`eventkart-staging`, then `eventkart-production`):**

- [ ] Project created, region `asia-southeast1-eqsg3a`.
- [ ] `postgres` service added (Railway Postgres template, version 17).
- [ ] `redis` service added (Railway Redis template, version 7).
- [ ] `api` service added; GitHub repo connected; Config File Path =
      `/railway.api.json`.
- [ ] `web` service added; GitHub repo connected; Config File Path =
      `/railway.web.json`; all `VITE_*` build-args declared in Settings
      → Build Args.
- [ ] `worker` service added; GitHub repo connected; Config File Path =
      `/railway.worker.json`.
- [ ] All env vars per §3 set on the right services. Triple-check the
      `web` build args before the first build (RISK-001).
- [ ] DNS CNAMEs added per §4; Railway certs land cleanly.
- [ ] Project Usage cap + alert thresholds configured per §8.
- [ ] Smoke tests per §7 pass against the new environment.
- [ ] (Production only) Railway native autodeploy is **disabled** on
      all three deployable services; the only deploy path is the GitHub
      Actions `v*` tag workflow (per RISK-007 and REQ-002).
- [ ] (Staging only) Railway "Wait for CI" is **enabled** on all three
      deployable services so Railway only deploys after the GitHub
      `ci.yml` push workflow passes.

---

## Appendix B — Risk register (Railway-specific subset)

The full risk register lives in
[infrastructure-railway-deployment.md §11](../impl-plan/infrastructure-railway-deployment.md).
The three risks operators most need on speed-dial:

### RISK-002 — Cookie-leak via shared CDN cache

**Mitigation in this runbook:** §1.2 keeps Cloudflare in front of `web`
only. The `api` DNS records in §4 are explicitly **DNS-only** (grey-cloud).
**Do not change without reading §1.2 in full.** The cookie-clear hook
in `apps/api/src/plugins/auth.ts` writes `Set-Cookie` on every response;
combined with `Cache-Control: public` on a shared CDN, this would leak
session cookies across users.

**Detection:** any new 🟠 proxied DNS record on `api.eventkart.run` or
`api-staging.eventkart.run` is the symptom. Cloudflare Analytics →
Cache → if cached MIME types include `text/html` from the `api.*`
hostname, the invariant has been broken.

### RISK-003 — `preDeployCommand` failure leaves old code running with old schema

**Mitigation:** this is the **desired behaviour** vs the old GH-Actions
pattern where a failed migration left schema ahead of code. Railway's
`preDeployCommand` runs `pnpm --filter @repo/db db:migrate:run` against
the new image; on non-zero exit, Railway aborts the deploy and the
**previous** api deploy keeps serving the **previous** schema.

**On-call procedure when it fires:**

1. Railway dashboard → api service → Deployments → click the failed
   deploy → "Pre-Deploy" tab. The migration runner's stderr is here.
2. Identify the failing migration file
   (`packages/db/drizzle/NNNN_<name>.sql`).
3. Open a PR with the fix (either the migration file itself, or a new
   migration that supersedes it).
4. Merge + redeploy. The next `preDeployCommand` runs the failing
   migration anew with the fix.
5. **Do not** manually run the migration against production to "unblock
   the deploy" — the rollout will then race the next deploy's
   `preDeployCommand`.

### RISK-007 — Production `v*` tag deploys are not Railway native autodeploy

**Mitigation:** `.github/workflows/deploy-production.yml` triggers on
`v*` tag push and calls `railway up` for each of api + web + worker
using the project-scoped `RAILWAY_TOKEN_PRODUCTION`. Railway's current
autodeploy docs cover branch triggers only — when Railway ships
documented tag filters, this workflow can be retired in favour of
native autodeploy.

**Implications today:**

- `RAILWAY_TOKEN_PRODUCTION` is a long-lived secret in GitHub repo
  settings. Quarterly rotation per §5.1 is non-negotiable.
- The `workflow_dispatch` + `confirm: 'yes'` gate is the only way to
  trigger production deploys outside a tag push (used for redeploys
  - emergency rollbacks).

---

## Appendix C — Glossary

- **Railway private network:** a Wireguard-encrypted overlay between
  services in the same project. DNS suffix `*.railway.internal`.
  Available at runtime only (NOT during Docker builds).
- **`RAILWAY_PRIVATE_DOMAIN`:** Railway-injected env var on every
  service that resolves to that service's `*.railway.internal` host.
  Reference variable: `${{api.RAILWAY_PRIVATE_DOMAIN}}` resolves to the
  api service's private host inside the same project.
- **`drainingSeconds`:** SIGTERM grace window. Railway sends `SIGTERM`,
  waits this many seconds for the process to exit cleanly, then sends
  `SIGKILL`.
- **`overlapSeconds`:** zero-downtime cutover window. Railway keeps the
  old replica accepting traffic for this many seconds after the new
  replica passes its healthcheck. Set to `0` on `worker` to prevent
  double-job processing.
- **`preDeployCommand`:** runs in a separate container using the
  application image, after build and before the application container
  starts. Non-zero exit blocks the rollout.
- **Config File Path:** Railway dashboard field that points at a
  service-specific `railway.*.json`. In monorepos this MUST point to
  the root-level file (`/railway.api.json`, etc.) — config files do
  NOT follow the service Root Directory path.
