# Docker Deployment — Current Architecture & Recommendations

Status: **Partially implemented.** The current Docker/CI hardening is reflected in the working tree; the remaining recommendations below are future optimization and release-policy work.

## Current setup (2 images, 1 install — how it actually works)

Yotara ships as two containers built from the monorepo root:

- **`api`** — Fastify + SQLite + Better Auth (`apps/api/Dockerfile`)
- **`frontend`** — Angular static files served by nginx, proxying `/api` and `/docs` to the `api` container (`apps/frontend/Dockerfile`)

### The API image (`apps/api/Dockerfile`) — multi-stage

1. **Build stage** (`node:22.22.3-alpine`): copies the root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, plus `apps/api`, `packages/shared` package.json → `pnpm install --frozen-lockfile --ignore-scripts` → `pnpm version:gen` → build `@yotara/shared` then `@yotara/api`.
2. **Prod stage** (clean `node:22.22.3-alpine`): does a **second, separate** `pnpm install --frozen-lockfile --prod --ignore-scripts` for the API's prod deps, then copies only `packages/shared/dist`, `apps/api/dist`, and `apps/api/drizzle` from the build stage. No source files in the final image.
3. Runs as `USER node`, `read_only` rootfs, `tmpfs /tmp`, drops capabilities, `no-new-privileges`.

### The frontend image (`apps/frontend/Dockerfile`)

1. **Build stage** (`node:22.22.3-alpine`): copies root + `apps/api`, `apps/frontend`, `packages/shared` package.json → **`pnpm install --frozen-lockfile` (full, not prod-only)** → builds `@yotara/shared` then `@yotara/frontend`.
2. **Runtime stage** (`nginx:1.27-alpine`): copies only the built `dist/frontend/browser` into the nginx html root. nginx config (`docker/nginx.conf`) uses the `CONTENT_SECURITY_POLICY` env var via envsubst.

### What "1 install" means today

- The API build stage installs the **whole workspace dependency graph** (pnpm resolves the entire lockfile even though only `@yotara/api` + `@yotara/shared` are built).
- The API prod stage **reinstalls prod-only** in a clean stage.
- The frontend build stage **installs everything again** (including the API's deps) and never prunes — the nginx image carries the full node_modules tree's build output in the build stage; the runtime image itself only has static files, but the build still paid for a full install.

So in practice: **two images, two full pnpm installs, plus one prod-only reinstall** — with only `@yotara/api`, `@yotara/frontend`, and `@yotara/shared` actually being deployed.

## Problems / inefficiencies

1. **Redundant full installs per image** — the frontend image installs the API's dependencies; the API image installs the frontend's build deps. Neither needs the other's tree. Build-time is doubled and cache misses hit both.
2. **The frontend build stage never prunes to prod deps** — it installs everything and keeps it for the build; the runtime stage only takes static files, so the waste is build-time + layer size of the build stage (which is discarded), but CI pays for a full install that only needs the frontend's deps.
3. **`docker-compose.hub.yml` deploys `latest`** — non-reproducible; the same "latest" can move between releases, and rollback is ambiguous (anti-pattern audit #19).
4. **Base images pinned to tags, not digests** (`node:22.22.3-alpine`, `nginx:1.27-alpine`) — the same source + lockfile can produce different images over time as base tags move (audit #19).
5. **CI compose overrides are generated at runtime** (`docker-compose.ci.yml`, `docker-compose.api-ci.yml`) and don't exist in the repo — brittle, not reviewable, easy to drift from the real compose file.
6. **Docker smoke CI job has no `if: always()` teardown** (audit #12) and a fixed `sleep 5` before a script that already polls (audit #13).
7. **No `.dockerignore` for `docker/`, `docs/`, `scripts/`** — they're shipped in the build context to both images even though neither needs them.
8. **No SBOM / scan step** in the release pipeline for the final images (audit #19 suggestion).

## Recommendations (priority order)

### 1. Single shared pnpm install layer (biggest win)

Both Dockerfiles start identically. Extract a **shared `deps` stage** into `docker/Dockerfile.deps` (or a base image) that both `apps/api/Dockerfile` and `apps/frontend/Dockerfile` reference:

```dockerfile
# docker/Dockerfile.deps
FROM node:22.22.3-alpine AS deps
WORKDIR /app
RUN corepack enable && apk add --no-cache python3 build-base
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
```

Then each app Dockerfile starts with `FROM <shared-deps> AS deps` (or `COPY --from=deps /app/node_modules ...`). Buildkit caches the shared install once; both images reuse it. CI and local builds pay **one** install instead of two.

### 2. Prune the frontend build to prod deps

- The frontend build stage should use `--prod` (or a filter) so it only resolves what the frontend actually needs at build time. The runtime stage already copies only static assets — the win is faster CI + smaller build-stage layer.
- The API prod stage already does prod-only; keep it, but source it from the shared `deps` stage's node_modules (or from the shared install) instead of reinstalling.

### 3. Pin base images to digests + release-tagged images (audit #19)

- Replace `node:22.22.3-alpine` / `nginx:1.27-alpine` with **digest-pinned** versions (e.g. `node@sha256:...`), updated via automation (Renovate/Dependabot).
- Publish the app images with **immutable tags**: `latest` + `vX.Y.Z` + `X.Y.Z` + commit-SHA. Deploy a specific version tag, not `latest`, on the EC2 beta.
- Generate an **SBOM** and scan the final images in release CI.

### 4. Make CI compose overrides real files

- Move `docker-compose.ci.yml` and `docker-compose.api-ci.yml` into the repo (e.g. `docker/`), checked in and reviewable, instead of generating them in CI.
- Add the missing `if: always()` teardown step after the smoke job's log collection (audit #12).
- Remove the `sleep 5` and let `scripts/docker-smoke.sh` be the sole readiness authority (audit #13).

### 5. Add `.dockerignore` entries for `docker/`, `docs/`, `scripts/`

They're part of the build context today and unused by both images. Excluding them shrinks context transfer and layer-cache invalidation.

### 6. (Optional, later) Single "build" image + two slim runtimes

The cleanest end state: one Dockerfile (or stage) that installs once and produces both `dist` outputs, then two tiny runtime images (api: node + dist; frontend: nginx + static) that `COPY --from=build`. This is the natural evolution of recommendation 1 and pairs with digest pinning.

## Beta recommendation (what to do now)

- **Do**: recommendations **1, 2, 3** (shared install, prune frontend, digest + release tags) — low-risk, high-value, directly make the EC2 beta smaller and reproducible.
- **Do**: **4** (realize CI compose files + teardown + drop sleep) as cleanup while we're in the workflow anyway.
- **Do**: **5** (dockerignore) — trivial.
- **Defer**: **6** (single-build refactor) until after beta, along with SBOM/scan if not already planned.

## Files that would change

| File | Change |
|:---|:---|
| `docker/Dockerfile.deps` (new) | Shared pnpm install stage |
| `apps/api/Dockerfile` | Use shared deps stage; digest-pin base |
| `apps/frontend/Dockerfile` | Use shared deps stage; `--prod` install; digest-pin base |
| `docker/nginx.conf` | (unchanged) — CSP injection stays as-is |
| `docker-compose.yml` | (unchanged for now) |
| `docker-compose.hub.yml` | Deploy release tags instead of `latest` |
| `.dockerignore` | Exclude `docker/`, `docs/`, `scripts/` |
| `.github/workflows/ci.yml` | Check in compose overrides; teardown step; drop `sleep 5` |
| `.github/workflows/release.yml` | Publish SHA tags; SBOM + scan (optional) |

## Open questions

- Should the shared deps stage live in `docker/Dockerfile.deps` (referenced by both Dockerfiles via a build arg / `COPY --from`) or as a **base image** pushed to Docker Hub? (Recommend: `Dockerfile.deps` — no extra registry dependency.)
- For the beta, which release tag do we deploy on EC2 — `vX.Y.Z` or commit-SHA? (Recommend: `vX.Y.Z` — human-readable rollback.)
- Is the frontend's build-stage `--prod` acceptable, or do we keep the full install for the build (it only affects build time)? (Recommend: `--prod` — the frontend has no build-time-only deps that the lockfile doesn't already resolve.)
