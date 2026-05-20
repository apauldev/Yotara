FROM node:22-alpine

WORKDIR /app
RUN corepack enable
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild better-sqlite3

COPY scripts scripts
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm version:gen
RUN pnpm --filter @yotara/shared build
RUN pnpm --filter @yotara/api build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=./apps/api/data/yotara.db
ENV APP_BASE_URL=http://localhost:8080/api
ENV TRUSTED_ORIGINS=http://localhost:8080

EXPOSE 3000

CMD ["node", "/app/apps/api/dist/server.js"]
