# syntax=docker/dockerfile:1.7
# Multi-stage build for EventKart Fastify API (TASK-201, TASK-202, TASK-204)
# Stages: deps → build → runtime (alpine, multi-stage to keep runtime image small)
ARG NODE_VERSION=22.12-alpine
ARG PNPM_VERSION=10.33.2

# ---------- Stage 1: deps ----------
# Install full workspace dependencies (incl. devDeps required to build TS).
FROM node:${NODE_VERSION} AS deps
ARG PNPM_VERSION
WORKDIR /app

# corepack bundled with node:22.12 has outdated signing keys; refresh it first.
RUN npm install -g corepack@latest \
	&& corepack enable \
	&& corepack prepare pnpm@${PNPM_VERSION} --activate

# Workspace manifests (copy only what pnpm needs to resolve the graph).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM deps AS build
WORKDIR /app

# Copy the rest of the source for the API + workspace deps it needs.
COPY tsconfig.json ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Build api (and any workspace deps it needs via turbo's `...` selector).
RUN pnpm --filter api... build

# ---------- Stage 3: runtime ----------
# Final image — keeps pnpm + tsx so the Railway preDeployCommand
# `pnpm --filter @repo/db db:migrate:run` works inside the container.
# To keep the image small, we do a *filtered* install scoped to api + @repo/db
# (skips web/ui's heavy dev deps like vite, react-dom, @sentry/tanstackstart).
FROM node:${NODE_VERSION} AS runtime
ARG PNPM_VERSION
ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g corepack@latest \
	&& corepack enable \
	&& corepack prepare pnpm@${PNPM_VERSION} --activate

# Workspace metadata (pnpm walks up looking for pnpm-workspace.yaml).
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/turbo.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/.npmrc ./

# Workspace package manifests (needed for pnpm to resolve the filtered graph).
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/ui/package.json ./packages/ui/package.json
COPY --from=build /app/packages/typescript-config/package.json ./packages/typescript-config/package.json

# Filtered install: only api + db (and their transitive workspace deps shared,
# typescript-config). Web and ui are skipped entirely.
# --prod skips devDeps (saves ~150 MB of biome/turbo/typescript/prettier/jsdom).
# tsx is installed globally below because the migration script (db:migrate:run)
# is `tsx scripts/migrate.ts` and tsx lives in @repo/db's devDependencies — which
# --prod skips. Globally installed tsx is found via PATH when pnpm runs the
# script, so `pnpm --filter @repo/db db:migrate:run` keeps working in Railway's
# preDeployCommand.
RUN pnpm install --frozen-lockfile --prod \
	--filter "api..." \
	--filter "@repo/db..." \
	&& npm install -g tsx@4.21.0

# API app (compiled output + tsconfig for tsx; no source).
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Workspace deps required at runtime / for the migration script.
# packages/db is consumed in two ways:
#   1. compiled API imports it via its `exports` field (TS source resolved by node)
#   2. `pnpm --filter @repo/db db:migrate:run` runs `tsx scripts/migrate.ts`
# So we need its full source + drizzle migrations + scripts.
COPY --from=build /app/packages/db/src ./packages/db/src
COPY --from=build /app/packages/db/scripts ./packages/db/scripts
COPY --from=build /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=build /app/packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY --from=build /app/packages/db/tsconfig.json ./packages/db/tsconfig.json
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY --from=build /app/packages/typescript-config ./packages/typescript-config

EXPOSE 3001

# WORKDIR /app/apps/api so the railway.api.json startCommand
# `node --import tsx dist/server.js` resolves correctly. pnpm walks up to
# find pnpm-workspace.yaml at /app, so `pnpm --filter @repo/db db:migrate:run`
# works as a preDeployCommand from any cwd.
#
# Runtime contract: the compiled API at `dist/server.js` imports `@repo/db`
# and `@repo/shared`, which export raw `.ts` source via their package.json
# `exports` fields (no separate dist build). Plain `node` cannot rewrite
# `./foo.js` import specifiers inside those `.ts` files to `./foo.ts`,
# so we register `tsx` as the loader via `--import tsx`. tsx is installed
# globally above so it resolves from any cwd. The performance overhead is
# negligible at module-load and zero in the request-handling hot path
# (tsx caches transformations).
WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "dist/server.js"]
