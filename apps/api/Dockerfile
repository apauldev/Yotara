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

# Compile native modules (build stage has python/build-base for node-gyp fallback)
RUN pnpm rebuild --filter @yotara/api better-sqlite3

# Save compiled binary to a version-independent path for the production stage
RUN mkdir -p /app/native && \
    cp "$(find /app/node_modules/.pnpm -path '*/better-sqlite3/build/Release/better_sqlite3.node' | head -1)" /app/native/

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

# Try to rebuild native module — prebuild-install works on amd64/arm64
# On architectures without prebuilds (e.g. s390x), this fails and we use the
# build-stage binary instead (compiled with python/build-base available).
RUN pnpm rebuild --filter @yotara/api better-sqlite3 2>/dev/null; exit 0

# Fallback: copy the build-stage binary if production rebuild didn't produce one
COPY --from=build /app/native/better_sqlite3.node /tmp/
RUN PKG_DIR="$(find /app/node_modules/.pnpm -path '*/node_modules/better-sqlite3' -type d | head -1)" && \
    if [ ! -f "$PKG_DIR/build/Release/better_sqlite3.node" ]; then \
      mkdir -p "$PKG_DIR/build/Release" && \
      cp /tmp/better_sqlite3.node "$PKG_DIR/build/Release/better_sqlite3.node"; \
    fi

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
