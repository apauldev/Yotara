# Contributing to Yotara

Thanks for your interest in contributing to Yotara. This guide covers the development workflow, standards, and process for submitting changes.

## Code of Conduct

Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

## Getting Started

### Prerequisites

- **Node.js** 18 or newer
- **pnpm** 9 or newer

### Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Yotara.git
   cd Yotara
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```
   This runs `pnpm prepare` which sets up Husky Git hooks.

3. Start the dev server:
   ```bash
   pnpm dev
   ```

4. Open two browser tabs:
   - http://localhost:4200 (frontend)
   - http://localhost:3000/docs (API docs)

For detailed setup instructions, see [PROJECT_README.md](./PROJECT_README.md).

## What to Work On

### Good First Issues

Browse [good-first-issue](https://github.com/apauldev/Yotara/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) labels for scoped tasks designed for new contributors.

### Architecture and Planned Work

Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for:

- Current state vs planned work
- Sprint tracking and issue links
- Anti-pattern registry
- Code quality standards
- Technical decisions

### Ideas

If you don't see what you'd like to work on:

1. Open an issue describing the idea before writing code
2. Tag it with the appropriate label (`enhancement`, `bug`, `documentation`)
3. Check ARCHITECTURE.md to ensure it aligns with current priorities

## Development Workflow

### Branch Naming

```
feature/task-detail-modal     # new features
fix/logout-redirect           # bug fixes
docs/testing-guide            # documentation
refactor/task-service         # code improvements
```

### Make Changes

- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation if adding features
- Reference the relevant ARCHITECTURE.md item or issue

### Verify Quality

```bash
pnpm format        # Auto-format code
pnpm lint:fix      # Auto-fix linting issues
pnpm format:check  # Verify formatting
pnpm typecheck     # Run TypeScript validation
pnpm test          # Run all tests
```

All checks must pass before submitting a PR.

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/). This is enforced via `commitlint`.

| Type | Description | Version Bump |
|:---|:---|:---|
| `feat:` | New feature | Minor |
| `fix:` | Bug fix | Patch |
| `docs:` | Documentation | Patch |
| `test:` | Test coverage | Patch |
| `refactor:` | Code improvement | Patch |
| `chore:` | Maintenance | Patch |
| `feat!:` or `fix!:` | Breaking change | Major |

Examples:

```bash
git commit -m "feat(tasks): add priority levels to task detail modal"
git commit -m "fix(auth): redirect to onboarding after signup"
git commit -m "feat!: migrate to new core engine"
```

### Pull Requests

Use the [PR template](./.github/pull_request_template.md). Include:

- **What**: Brief description of changes
- **Why**: Problem it solves or feature it adds
- **How**: Technical approach (if non-obvious)
- **Testing**: How to verify the change works
- **Architecture link**: Reference ARCHITECTURE.md item if applicable

### Code Review

- Address review feedback respectfully
- Request re-review once changes are made
- Merge requires at least one approval

## Project Structure

```
apps/
  frontend/          Angular 21 application
    src/app/
      core/          Guards, interceptors, services
      features/      Feature modules (auth, error, onboarding, personal, shell, tasks)
      shared/        Reusable components, pipes, directives
  api/               Fastify backend
    src/
      db/            Database schema and client
      docs/          OpenAPI spec and validation
      lib/           Auth origins, CORS utilities
      plugins/       Fastify plugins (CORS, auth)
      routes/        API endpoints
      services/      Business logic (tasks, labels, projects)
packages/
  shared/            TypeScript domain types
scripts/
  dev.mjs            Local development runner
  release.mjs        Release automation
```

## API Development

- **Auth**: [Better Auth](https://www.better-auth.com) with session cookies
- **Database**: [SQLite](https://www.sqlite.org) via [Drizzle ORM](https://orm.drizzle.team)
- **Framework**: [Fastify 5](https://www.fastify.io)
- **Docs**: OpenAPI at `/docs` (Swagger UI) and `/docs/openapi.json`

## Testing

See [testing.md](./testing.md) for patterns and best practices.

| Suite | Framework | Location |
|:---|:---|:---|
| API | Node test runner + tsx | `apps/api/src/**/*.test.ts` |
| Frontend | Karma + Jasmine | `apps/frontend/src/app/**/*.spec.ts` |

Quick commands:

```bash
pnpm test                    # Run all tests
pnpm --filter @yotara/api test       # API tests only
pnpm --filter @yotara/frontend test  # Frontend tests only
```

## Versioning and Releases

See [docs/RELEASING.md](./docs/RELEASING.md) for the full release process.

```bash
pnpm release -- --dry-run   # Preview release
pnpm release                 # Create release
```

## Helpful Resources

- [PROJECT_README.md](./PROJECT_README.md) -- Setup, scripts, dev environment
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) -- Technical roadmap and anti-patterns
- [testing.md](./testing.md) -- Testing patterns and best practices
- [docs/RELEASING.md](./docs/RELEASING.md) -- Release process
- [Conventional Commits](https://www.conventionalcommits.org/) -- Commit message format
- [Yotara on GitHub](https://github.com/apauldev/Yotara)

## Questions or Need Help?

- **GitHub Issues**: Open an issue with the `question` label
- **Discussions**: Start a discussion for longer conversations
- **Code Review**: PR reviewers are here to help -- ask questions
