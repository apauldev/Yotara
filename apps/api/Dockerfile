# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

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

# Compile native modules
RUN pnpm rebuild --filter @yotara/api better-sqlite3

COPY scripts scripts
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm version:gen
RUN pnpm --filter @yotara/shared build
RUN pnpm --filter @yotara/api build

# --- Production stage — clean node:22-alpine, no python/build-base ---

FROM node:22-alpine

WORKDIR /app
RUN corepack enable

# Install production dependencies (skip lifecycle scripts to avoid husky failing)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Rebuild native module — runs prebuild-install which downloads a prebuilt binary
# (no python/build-base needed; uses the workspace filter to find the dependency)
RUN pnpm rebuild --filter @yotara/api better-sqlite3

# Copy built artifacts (no source files)
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=./apps/api/data/yotara.db
ENV APP_BASE_URL=http://localhost:8080/api
ENV TRUSTED_ORIGINS=http://localhost:8080

EXPOSE 3000

CMD ["node", "/app/apps/api/dist/server.js"]
