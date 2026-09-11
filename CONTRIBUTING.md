# Contributing to Yotara

Thanks for your interest in contributing to Yotara. This guide covers the development workflow, standards, and process for submitting changes.

## Code of Conduct

Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

## Getting Started

### Prerequisites

- **Node.js** 22.22.3 or newer
- **pnpm** 10.30.3 or newer

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/Yotara.git
cd Yotara
pnpm install
pnpm dev
```

`pnpm install` also runs `pnpm prepare`, which sets up the Husky Git hooks. `pnpm dev` starts the frontend on http://localhost:4200 and the API on http://localhost:3000.

See [docs/INSTALL.md](./docs/INSTALL.md) for the full setup guide, environment files, and the Docker path.

## What to Work On

### Good First Issues

Browse [good-first-issue](https://github.com/apauldev/Yotara/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) labels for scoped tasks designed for new contributors.

### Architecture and Planned Work

Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for:

- Current state and system shape
- Architectural decisions and engineering principles
- Known risks and technical debt
- Testing and verification policy

For what's being worked on now, see the [Yotara Roadmap](https://github.com/users/apauldev/projects/1) Project board and GitHub Issues.

### Ideas

If you don't see what you'd like to work on:

1. Open an issue describing the idea before writing code
2. Tag it with the appropriate label (`enhancement`, `bug`, `documentation`)
3. Check [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) to ensure it aligns with current priorities

## Development Workflow

### Branch Naming

There is no hook enforcing branch names, but the convention is `<type>/<short-description>`:

```
feat/task-detail-modal     # new features
fix/logout-redirect        # bug fixes
docs/testing-guide         # documentation
refactor/task-service      # code improvements
```

`feature/` is also in common use, and `bug/`, `chore/`, and `misc/` appear in the history. Pick whichever prefix reads best; keep the description short and hyphenated.

### Make Changes

- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation if adding features
- Reference the relevant issue or [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) item

### Verify Quality

```bash
pnpm format        # Auto-format code
pnpm lint:fix      # Auto-fix linting issues
pnpm format:check  # Verify formatting
pnpm lint          # Lint without modifying files (what CI runs)
pnpm typecheck     # Run TypeScript validation
pnpm test          # Run all tests
pnpm build         # Verify the workspace builds
```

All checks must pass before submitting a PR. These are the same commands CI runs — see [CI and Automation](#ci-and-automation).

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/). This is enforced via `commitlint` on commit.

| Type | Description | Version Bump |
|:---|:---|:---|
| `feat:` | New feature | Minor |
| `fix:` | Bug fix | Patch |
| `docs:` | Documentation | Patch |
| `test:` | Test coverage | Patch |
| `refactor:` | Code improvement | Patch |
| `perf:`, `build:`, `ci:`, `style:` | Other maintenance | Patch |
| `chore:` | Maintenance | Patch |
| `feat!:` or `fix!:` | Breaking change | Major |

Examples:

```bash
git commit -m "feat(tasks): add priority levels to task detail modal"
git commit -m "fix(auth): redirect to onboarding after signup"
git commit -m "feat!: migrate to new core engine"
```

A plain `chore:` does produce a patch release — the release script ignores only `chore(release):` and `chore(deploy):`. Its own commits use those two prefixes to avoid triggering a release loop.

### Pull Requests

Use the [PR template](./.github/pull_request_template.md). Include:

- **What**: Brief description of changes
- **Why**: Problem it solves or feature it adds
- **How**: Technical approach (if non-obvious)
- **Testing**: How to verify the change works
- **Issue link**: Reference the issue or board item if applicable

### Code Review

- Address review feedback respectfully
- Request re-review once changes are made
- At least one maintainer approval is expected before merge

## Project Structure

```text
apps/
  api/               Fastify backend
    src/
      db/            Database schema and client
      docs/          OpenAPI spec and validation
      lib/           Auth origins, CORS, email, rate limiting
      plugins/       Fastify plugins (CORS, auth, rate limit)
      routes/        API endpoints and their colocated tests
      services/      Business logic (tasks, labels, projects, notifications)
  frontend/          Angular 22 application
    e2e/             Playwright specs, fixtures, and global setup
    src/app/
      core/          Guards, interceptors, services
      features/      Feature areas (auth, error, onboarding, personal, shell, tasks)
      shared/        Reusable components, UI primitives, pipes, utils
  yotara-website/    Static marketing site (yotara.website)
packages/
  shared/            TypeScript domain types, DTOs, and auth client
scripts/             Dev runner, release automation, versioning, smoke tests
docs/                Architecture, install, configuration, contributing, releasing
```

## How to Add a Feature

### Adding an API endpoint

1. Add a JSON Schema via the `withJsonResponse()` helper in `apps/api/src/routes/<resource>.ts` and pass it to the route's `{ schema: ... }` config
2. Add the handler — keep it thin, delegate to a service
3. Add or extend the service in `apps/api/src/services/<resource>-service.ts`
4. Add a **colocated** route test at `apps/api/src/routes/<resource>.test.ts` (tests live next to the code, not in a separate `test/` tree)
5. Run `pnpm --filter @yotara/api test` and verify Swagger at `http://localhost:3000/docs`

### Adding a frontend feature

1. Decide whether it is a page, a feature component, or a shared primitive, and put it in the matching folder
2. Use signals for state, `computed()` for derived state, `effect()` for side effects
3. If the feature calls the API, add a service method that uses `HttpClient` — not raw `fetch`
4. Log errors via `LogService`, not `console.error`
5. Reuse the shared `Modal`, `ConfirmDialog`, `EmptyStateComponent`, and `PageHeader` primitives rather than building new ones
6. **The golden rule:** if you find yourself filtering in a `computed()` signal, check whether the server can do it first. If it can, add a query param and delete the signal

## Engineering Principles

### Structural

- **The server should do the filtering.** Every computed signal that filters on a field the server could query (`status`, `completed`, `dueDate`) is a sign the API is missing an endpoint. Add the endpoint, remove the signal.
- **Services fetch. Components compose.** A component reading `taskService.todayTasks()` is fine. A component doing its own filtering is a sign the service is missing a view.
- **Shared patterns should be shared.** Extract duplicated markup or logic into a reusable component rather than copying it across files.
- **One source of truth for types and decisions.** The `shared` package owns domain types. Architecture decisions live in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). If a finding lives in neither place, it gets lost.

### Runtime

- **Errors at the boundary where they occur.** If a service can produce a validation error, return a typed `AppError`. Never `throw new Error('string')` and hope the route catches it. A Fastify `setErrorHandler` is the right place to map domain errors to HTTP status codes.
- **Invariant failures are 500s.** Use `AppError(500, ...)` for broken server invariants; reserve `BadRequestError` for bad input.
- **Async without timers.** If you are writing `setTimeout(() => doSomething(), N)` to make the UI feel responsive, that is a state-modeling problem. Use an Angular `effect()` or a signal and let change detection do the work.
- **Bugs are bugs, not refactors.** A refactor commit should not change behavior. If it does, split the commit.

### Testing

- **Tests at the boundary you want to keep stable.** Service tests are fast and catch regressions. Component tests verify rendering. Route tests catch request/response cycle bugs. All three matter.
- **Don't reach into component internals.** Use DOM assertions, the public API, or signal inspection. White-box tests (`as any` casts on `componentInstance`) couple the suite to the implementation and punish future refactors.
- **A "verify" item is a missing test.** If you can't write a test for it, you don't know that it works. Replace the checklist item with a test.
- **After changing a public API, update its tests.** Verify which specs exercise the code you changed and re-run them before calling the work done.

### Process

- **Architecture decisions live in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).** The "Important architectural decisions" section is the tripwire: if a change would reverse one of those decisions (server-side filtering, SQLite first, explicit timezone handling, security at the deployment boundary), it needs an explicit re-evaluation and a document update — not "let me just add it."
- **New work goes in GitHub Issues** and is tracked on the [Yotara Roadmap](https://github.com/users/apauldev/projects/1) Project board.
- **Keep unrelated changes in separate commits.** A docs rewrite should not ride along with a CI workflow change.

## CI and Automation

All workflows live in [`.github/workflows/`](./.github/workflows).

| Workflow | Trigger | Purpose |
|:---|:---|:---|
| [`ci.yml`](./.github/workflows/ci.yml) | Push to `main`, pull requests | Format, lint, typecheck, audit, tests, coverage, build, E2E, Docker smoke tests |
| [`release.yml`](./.github/workflows/release.yml) | CI completes on `main`, or manual dispatch | Version bump, changelog, tag, GitHub Release, Docker Hub publishing |
| [`codeql.yml`](./.github/workflows/codeql.yml) | Scheduled and on push/PR | CodeQL static analysis |
| [`secret-scan.yml`](./.github/workflows/secret-scan.yml) | Push and pull requests | Secret scanning |
| [`docs-consistency.yml`](./.github/workflows/docs-consistency.yml) | Changes to docs, Markdown, or `apps/api/.env.example` | Verifies every variable in `apps/api/.env.example` is documented in [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) |
| [`pr-agent.yml`](./.github/workflows/pr-agent.yml) | Pull requests | Automated PR review |

The `ci.yml` job breakdown and which checks are advisory are documented in [testing.md](./testing.md#5-cicd-integration).

Note that `ci.yml` ignores changes limited to `**.md`, `docs/**`, and `screenshots/**`, so a docs-only pull request skips the main pipeline. `docs-consistency.yml` deliberately has no such filter, so documentation changes still get checked.

The release pipeline is documented in [docs/RELEASING.md](./docs/RELEASING.md).

## Testing

See [testing.md](./testing.md) for patterns and best practices.

| Suite | Framework | Location |
|:---|:---|:---|
| API | Node test runner + tsx | `apps/api/src/**/*.test.ts` |
| Frontend | Karma + Jasmine | `apps/frontend/src/app/**/*.spec.ts` |
| E2E | Playwright | `apps/frontend/e2e/specs/**` |

Quick commands:

```bash
pnpm test                                # Run all unit/integration tests
pnpm --filter @yotara/api test           # API tests only
pnpm --filter @yotara/frontend test      # Frontend unit tests only
pnpm --filter @yotara/frontend e2e       # E2E tests (servers must be running)
```

## Versioning and Releases

Releases are automated. Merging to `main` triggers the release workflow once CI passes; maintainers do not run release commands by hand. See [docs/RELEASING.md](./docs/RELEASING.md) for the pipeline, the manual fallback, and troubleshooting.

## Contributor Agreement

Yotara asks contributors to do two complementary things. They serve different purposes, so both apply to every pull request.

### 1. Agree to the Contributor License Agreement

Before your first PR is merged, you need to agree to the [Yotara CLA](./CLA.md). It grants the project the rights to distribute your contributions under any license (MIT or future alternatives).

[CLAassistant](https://cla-assistant.io/) prompts you automatically on your first pull request, and the `license/cla` check stays red until you sign. There is no repository configuration for it — it is a GitHub App, configured outside the repo.

### 2. Certify the Developer Certificate of Origin

Sign off every commit to certify that you wrote the change or otherwise have the right to submit it:

```bash
git commit -s -m "feat(tasks): add priority levels to task detail modal"
```

The `-s` flag appends a `Signed-off-by:` trailer using your configured Git identity, certifying the [Developer Certificate of Origin](https://developercertificate.org/). Make sure `user.name` and `user.email` are set to your real identity first.

The CLA is the legal grant; the sign-off is your per-commit certification. The [PR template](./.github/pull_request_template.md) asks you to confirm both.

## Helpful Resources

- [docs/README.md](./docs/README.md) -- Index of all project documentation
- [docs/INSTALL.md](./docs/INSTALL.md) -- Setup, scripts, dev environment
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) -- Architecture decisions, constraints, known risks
- [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) -- Environment variable reference
- [testing.md](./testing.md) -- Testing patterns and best practices
- [docs/RELEASING.md](./docs/RELEASING.md) -- Release process
- [Conventional Commits](https://www.conventionalcommits.org/) -- Commit message format
- [Yotara on GitHub](https://github.com/apauldev/Yotara)

## Questions or Need Help?

- **GitHub Issues**: Open an issue with the `question` label
- **Discussions**: Start a discussion for longer conversations
- **Code Review**: PR reviewers are here to help -- ask questions
