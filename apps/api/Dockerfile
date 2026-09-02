# syntax=docker/dockerfile:1

FROM node:22.22.3-alpine AS build

ARG GIT_HASH=unknown
ARG GIT_BRANCH=unknown
ENV GIT_HASH=${GIT_HASH}
ENV GIT_BRANCH=${GIT_BRANCH}

WORKDIR /app
RUN corepack enable
RUN apk add --no-cache python3 build-base

# Only copy package files needed for API dependency resolution
# (frontend/package.json intentionally omitted — this image only serves the API)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Skip lifecycle scripts during install (prepare script needs git + scripts/ dir)
RUN pnpm install --frozen-lockfile --ignore-scripts

# better-sqlite3 v13 ships prebuilt binaries in the package tarball
# (prebuilds/<platform>-<arch>.node), so no native compilation is needed.

COPY scripts scripts
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm version:gen
RUN rm -f packages/shared/tsconfig.tsbuildinfo
RUN pnpm --filter @yotara/shared build
RUN pnpm --filter @yotara/api build

# --- Production stage — clean Node image, no python/build-base ---

FROM node:22.22.3-alpine

WORKDIR /app
RUN corepack enable

# Install production dependencies (skip lifecycle scripts to avoid husky failing)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --prod --ignore-scripts
RUN node -e "require('./apps/api/node_modules/better-sqlite3'); console.log('better-sqlite3 loaded successfully')"

# better-sqlite3 v13 uses the prebuilt binaries shipped in its tarball,
# so no native rebuild or binary copying is needed.

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

RUN mkdir -p /app/apps/api/data && chown node:node /app/apps/api/data

USER node

CMD ["node", "/app/apps/api/dist/server.js"]
