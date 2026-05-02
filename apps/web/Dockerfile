# syntax=docker/dockerfile:1.7
# Multi-stage build for EventKart TanStack Start web app
# Stages: deps → build → runtime (alpine)
ARG NODE_VERSION=22.12-alpine
ARG PNPM_VERSION=10.33.2

# ---------- Stage 1: deps ----------
FROM node:${NODE_VERSION} AS deps
ARG PNPM_VERSION
WORKDIR /app

# corepack bundled with node:22.12 has outdated signing keys; refresh it first.
RUN npm install -g corepack@latest \
	&& corepack enable \
	&& corepack prepare pnpm@${PNPM_VERSION} --activate

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

# VITE_* values are inlined at build time. publicEnv (apps/web/src/lib/env/public.ts)
# enforces VITE_API_URL via z.string().url() — missing values fail the build loudly.
ARG VITE_APP_TITLE
ARG VITE_API_URL
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED
ARG VITE_PUBLIC_SUPPORT_PHONE
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ARG VITE_SENTRY_TRACES_SAMPLE_RATE
ARG VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
ARG VITE_SITE_URL

# Sentry source-map upload — optional, only set in CI (FC-009). Leaving these
# unset disables the sentryTanstackStart Vite plugin (vite.config.ts:13).
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV VITE_APP_TITLE=${VITE_APP_TITLE} \
	VITE_API_URL=${VITE_API_URL} \
	VITE_POSTHOG_KEY=${VITE_POSTHOG_KEY} \
	VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST} \
	VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=${VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED} \
	VITE_PUBLIC_SUPPORT_PHONE=${VITE_PUBLIC_SUPPORT_PHONE} \
	VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
	VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT} \
	VITE_SENTRY_TRACES_SAMPLE_RATE=${VITE_SENTRY_TRACES_SAMPLE_RATE} \
	VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=${VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE} \
	VITE_SITE_URL=${VITE_SITE_URL} \
	SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
	SENTRY_ORG=${SENTRY_ORG} \
	SENTRY_PROJECT=${SENTRY_PROJECT}

# Copy source for web + shared workspace deps it needs.
COPY tsconfig.json ./
COPY packages/typescript-config ./packages/typescript-config
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN pnpm --filter web... build

# ---------- Stage 3: runtime ----------
# TanStack Start emits a self-contained Nitro server bundle; no pnpm/workspace
# needed at runtime — just node + .output.
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/web/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
