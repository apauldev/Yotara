# syntax=docker/dockerfile:1

# Keep in sync with the "packageManager" field in the root package.json.
ARG PNPM_VERSION=10.30.3

FROM node:26.12.1-alpine AS build

ARG PNPM_VERSION

WORKDIR /app

RUN npm install -g pnpm@${PNPM_VERSION} --no-fund --no-audit

# better-sqlite3 v13 ships prebuilt binaries in the package tarball
# (prebuilds/<platform>-<arch>.node), so python3/build-base are not needed.

# Only copy package files needed for API dependency resolution
# (frontend/package.json intentionally omitted — this image only serves the API)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Skip lifecycle scripts during install (prepare script needs git + husky)
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @yotara/shared build \
    && pnpm --filter @yotara/api build

# --- Production dependency stage — the expected runtime /app layout ---

FROM node:26.12.1-alpine AS prod-deps

ARG PNPM_VERSION

WORKDIR /app

RUN npm install -g pnpm@${PNPM_VERSION} --no-fund --no-audit && npm cache clean --force

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install production dependencies only (skip lifecycle scripts to avoid husky).
# auto-install-peers=false stops drizzle-orm's optional peers (prisma engine
# chain, pglite, effect, typescript) from being materialized — ~350MB — since
# the app only uses the better-sqlite3 adapter.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --config.auto-install-peers=false \
    && node -e "require('./apps/api/node_modules/better-sqlite3'); console.log('better-sqlite3 loaded successfully')" \
    && mkdir -p /app/apps/api/data \
    && chown node:node /app/apps/api/data

# --- Production stage — clean Node image, no build or package tooling ---

FROM node:26.12.1-alpine

WORKDIR /app

# Runtime tree: must copy the whole /app so pnpm's relative symlinks into
# node_modules/.pnpm keep resolving (copying individual node_modules dirs
# breaks the links).
COPY --from=prod-deps /app /app

# Copy built artifacts (no source files)
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle
# Dev-mode config (defaults to disabled in the image; override at runtime via
# the DEV_MODE env var or a mounted file).
COPY --from=build /app/apps/api/dev-mode.json /app/apps/api/dev-mode.json

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=./apps/api/data/yotara.db
# No /api path: the frontend nginx strips the /api prefix before proxying, so
# Better Auth must match /auth/* (its baseURL path must be empty).
ENV APP_BASE_URL=http://localhost:8080
ENV TRUSTED_ORIGINS=http://localhost:8080

EXPOSE 3000

USER node

# In-container path is /health; nginx exposes it at /api/health externally
# (verified by scripts/docker-smoke.sh).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "/app/apps/api/dist/server.js"]
