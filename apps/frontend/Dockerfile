# syntax=docker/dockerfile:1

FROM node:22.22.1-alpine AS build

WORKDIR /app
RUN corepack enable
RUN apk add --no-cache python3 build-base

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY scripts scripts
COPY packages/shared packages/shared
COPY apps/frontend apps/frontend

RUN pnpm version:gen
RUN rm -f packages/shared/tsconfig.tsbuildinfo
RUN pnpm --filter @yotara/shared build
RUN pnpm --filter @yotara/frontend build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/frontend/dist/frontend/browser /usr/share/nginx/html

# Inject the CSP into the nginx config from the env (single source of truth with
# the API). Falls back to the same default the API uses when unset.
ENV CONTENT_SECURITY_POLICY=

EXPOSE 80
