# Installing and Running Yotara

How to get Yotara running locally. For the self-hosted production path, see
[DOCKER.md](../DOCKER.md). Every setting mentioned here is documented in
[docs/CONFIGURATION.md](./CONFIGURATION.md).

## Requirements

- **Node.js** 22.22.3 or newer
- **pnpm** 10.30.3 or newer

## Local development

Recommended if you are contributing or working on the code.

```bash
git clone https://github.com/apauldev/Yotara.git
cd Yotara
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev
```

`pnpm install` also runs `pnpm prepare`, which installs the Husky Git hooks.

`pnpm dev` starts three processes through [`scripts/dev.mjs`](../scripts/dev.mjs):

| Service | URL | Notes |
|:---|:---|:---|
| Frontend | http://localhost:4200 | Angular dev server with hot reload |
| API | http://localhost:3000 | Fastify with auto-reload |
| API docs | http://localhost:3000/docs | Swagger UI, generated from the route schemas |
| Drizzle Studio | https://local.drizzle.studio | Database GUI, for local inspection only |

Drizzle Studio is optional — if its port is unavailable, the other two services
still start.

### Environment

`scripts/dev.mjs` loads `apps/api/.env` before starting the API, so copy it from
the example file as shown above. Local development works with an empty
`BETTER_AUTH_SECRET`; the API only enforces a strong secret when
`NODE_ENV=production`.

See [docs/CONFIGURATION.md](./CONFIGURATION.md) for every variable, its default,
and its purpose.

### Running one service at a time

```bash
pnpm dev:frontend
pnpm dev:api
pnpm db:studio
```

### Exercising the real email flow

By default local development uses dev mode, which logs verification and reset
emails to the console instead of sending them. To run the full email-first flow
against real Resend delivery:

```bash
pnpm dev:email
```

This sets `DEV_MODE=false` and `REQUIRE_EMAIL_VERIFICATION=true`. It requires
`RESEND_API_KEY` and `EMAIL_FROM` to be configured.

## Docker

Recommended for self-hosting. The stack runs behind a single nginx front on port
8080.

```bash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up --build -d
# Then open http://localhost:8080
```

`BETTER_AUTH_SECRET` is mandatory — Compose fails fast when it is unset, and the
API refuses to boot with placeholder, plain-text, malformed, or undersized
values. You can also use the pre-built images for a zero-build start:

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/apauldev/yotara/main/docker-compose.hub.yml
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d
```

See [DOCKER.md](../DOCKER.md) for security hardening, volumes, TLS termination,
and troubleshooting.

## Verifying the setup

Run the same checks CI runs before opening a pull request:

```bash
pnpm format:check   # Prettier validation
pnpm lint           # ESLint across the workspace
pnpm typecheck      # TypeScript validation
pnpm test           # API + frontend suites
pnpm build          # Verify the workspace builds
```

E2E tests need both servers running first:

```bash
pnpm --filter @yotara/frontend e2e
```

## Workspace commands

### From the repository root

| Command | Description |
|:---|:---|
| `pnpm dev` | Start all local services |
| `pnpm dev:frontend` / `pnpm dev:api` / `pnpm db:studio` | Start one service |
| `pnpm dev:email` | Start locally in the real email-flow mode |
| `pnpm build` | Build all packages |
| `pnpm start` | Run production builds |
| `pnpm lint` / `pnpm lint:fix` | Lint, with or without auto-fix |
| `pnpm format` / `pnpm format:check` | Format, or verify formatting |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Run all test suites |
| `pnpm test:coverage` | Run with coverage |
| `pnpm docs:check` | Validate the OpenAPI spec |
| `pnpm release` | Cut a release (maintainers; normally automated) |
| `pnpm docker:up` / `pnpm docker:down` | Build and start, or stop, the Compose stack |
| `pnpm smoke:docker` | Verify the running Docker stack |

### From `apps/api`

| Command | Description |
|:---|:---|
| `pnpm dev` | Start the API server |
| `pnpm build` | Compile TypeScript |
| `pnpm test` | Run API tests |
| `pnpm docs:check` | Validate the OpenAPI spec |
| `pnpm docs:export` | Export the spec to a file |
| `pnpm db:generate` / `pnpm db:push` | Generate a migration, or push the schema |
| `pnpm db:studio` | Open Drizzle Studio |

### From `apps/frontend`

| Command | Description |
|:---|:---|
| `pnpm dev` | Start the Angular dev server |
| `pnpm build` | Production build |
| `pnpm test` | Karma unit tests in ChromeHeadless |
| `pnpm e2e` | Playwright E2E tests |
| `pnpm lint` | Typecheck plus stylelint |

## Where data lives

The SQLite database defaults to `./data/yotara.db` for local development, created
automatically on first run. The Docker stack keeps it in the `yotara_api_data`
volume. To reset a local database, stop the dev server and delete the file.

Back up that single file and you have backed up everything.

## Troubleshooting

**Port already in use.** The dev runner reports which service failed to bind.
Stop the process holding the port, or set `PORT` for the API.

**`pnpm dev` cannot find `apps/api/.env`.** Copy it from the example file:
`cp apps/api/.env.example apps/api/.env`.

**API exits at boot in production mode.** `BETTER_AUTH_SECRET` is missing or too
weak. The error names the failing check. Generate one with
`openssl rand -base64 32`.

**Frontend cannot reach the API.** The dev default expects the API on
`http://localhost:3000`. If you changed `PORT`, update
`apps/frontend/src/environments/environment.ts` to match.

**`pnpm build` fails with TypeScript errors.** Build from the repository root so
`tsconfig.base.json` resolves, then re-run.

**Session or CSRF errors on a custom origin.** Add your origin to
`TRUSTED_ORIGINS`. Wildcards are rejected at boot by design.

## Next steps

- [docs/README.md](./README.md) — index of all documentation
- [docs/CONFIGURATION.md](./CONFIGURATION.md) — environment variable reference
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — how the system fits together
- [CONTRIBUTING.md](../CONTRIBUTING.md) — workflow, conventions, and CI
- [DOCKER.md](../DOCKER.md) — self-hosting in production
