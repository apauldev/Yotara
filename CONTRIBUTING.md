# Contributing to Yotara

Thanks for your interest in contributing to Yotara! We're building a calm, self-hosted task manager, and we'd love your help.

This guide will help you get started. Whether you're fixing a bug, adding a feature, improving docs, or expanding test coverage—we appreciate it.

---

## Code of Conduct

Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

---

## Getting Started

### Prerequisites

- **Node.js** 18 or newer
- **pnpm** 9 or newer (package manager for the monorepo)

### Set Up Your Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Yotara.git
   cd Yotara
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```
   This also runs `pnpm prepare`, which sets up Husky Git hooks.

3. **Start the dev server**
   ```bash
   pnpm dev
   ```
   This starts:
   - Frontend: `http://localhost:4200`
   - API: `http://localhost:3000`
   - Drizzle Studio: `https://local.drizzle.studio`

For more detailed setup instructions, see [PROJECT_README.md](./PROJECT_README.md#running-locally).

---

## Running Tests

We use:
- **Backend**: Node.js native test runner with `tsx`
- **Frontend**: Karma and Jasmine via Angular CLI

### Run all tests
```bash
pnpm test
```

### Test specific packages
```bash
pnpm --filter @yotara/api test
pnpm --filter @yotara/frontend test
```

### Frontend watch mode (during development)
```bash
pnpm --filter @yotara/frontend test -- --watch
```

For testing patterns and best practices, see [testing.md](./testing.md).

---

## Code Quality Checks

Before submitting a PR, verify:

```bash
pnpm lint          # Check for linting issues
pnpm typecheck     # Run TypeScript type checking
pnpm format:check  # Verify code formatting
pnpm test          # Run all tests
```

### Auto-fix issues (optional)
```bash
pnpm format        # Auto-format code
pnpm lint:fix      # Auto-fix linting issues
```

---

## What to Work On

### Good First Issues

Look for issues labeled **`good-first-issue`** or **`help-wanted`**. These are scoped tasks designed for new contributors.

### Medium Effort

Check the [MVP Roadmap](./ROADMAP.md) for the next screens and features to build. It includes:
- Priority order (what to build first)
- Component structure recommendations
- Effort estimates

### Ideas

If you don't see what you'd like to work on:
- **Open an issue** describing the idea before investing time in code
- Tag it with the appropriate label (e.g., `enhancement`, `bug`, `documentation`)
- Check the [ROADMAP.md](./ROADMAP.md) to make sure it aligns with the MVP

---

## Branching & PR Process

### 1. Create a branch
```bash
git checkout -b feature/your-feature-name
```

Use a clear, descriptive branch name:
- `feature/task-detail-modal` (new features)
- `fix/logout-redirect` (bug fixes)
- `docs/testing-guide` (documentation)
- `refactor/task-service` (code improvements)

### 2. Make your changes

- Write code following the existing style and patterns
- Add tests for new functionality
- Update documentation if you're adding features
- Link to the relevant [ROADMAP.md](./ROADMAP.md) item or issue

### 3. Verify quality locally

```bash
pnpm format
pnpm lint:fix
pnpm typecheck
pnpm test
```

### 4. Commit and push

Use clear, descriptive commit messages:
```
feat: implement task detail modal with subtasks

- Add TaskDetailComponent with edit form
- Implement subtask CRUD logic
- Add test coverage for new component
- Fixes #123
```

### 5. Open a pull request

Use the [PR template](./.github/pull_request_template.md) (it will auto-populate). Include:
- **What**: Brief description of changes
- **Why**: Problem it solves or feature it adds
- **How**: Technical approach (if non-obvious)
- **Testing**: How to verify the change works
- **Roadmap link**: Reference [ROADMAP.md](./ROADMAP.md) item if applicable

### 6. Code review

- Address review feedback respectfully
- Request re-review once changes are made
- Merge requires at least one approval

---

## Conventional Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear history and automated versioning. **This is enforced via `commitlint` hooks.**

- `feat:` — new feature (Minor bump)
- `fix:` — bug fix (Patch bump)
- `docs:` — documentation (Patch bump)
- `test:` — test coverage (Patch bump)
- `refactor:` — code improvements (Patch bump)
- `chore:` — maintenance (Patch bump)
- `feat!:` or `fix!:` — **Breaking Change** (Major bump)

Example:
```bash
git commit -m "feat(tasks): add priority levels to task detail modal"
git commit -m "fix(auth): redirect to onboarding after signup"
git commit -m "feat!: migration to a new core engine" # Breaking change!
```

If your commit message doesn't follow this format, the commit will be rejected by our Git hooks.

---

## Versioning & Releases

### How version bumps work

Every merge to `main` triggers the [Release workflow](.github/workflows/release.yml), which runs `pnpm release` (`scripts/release.mjs`). That script does three things:

1. **Gathers all commits** since the last tagged release — it traverses through merge commits so commits from every merged branch are analysed, not just the merge message itself.
2. **Classifies them** by conventional-commit type and determines the bump:

   | At least one commit of type | Bump | Example |
   |---|---|---|
   | `feat!:` / `BREAKING CHANGE` | **Major** | `0.43.19 → 1.0.0` |
   | `feat:` | **Minor** | `0.43.19 → 0.44.0` |
   | only `fix:`, `docs:`, etc. | **Patch** | `0.43.19 → 0.43.20` |

3. **Runs `commit-and-tag-version`** with the correct `--release-as` flag, which updates the CHANGELOG, creates a Git tag, and commits the bump.

The version lands in `package.json` and is propagated to the frontend at build time via `scripts/generate-version.mjs`.

### What triggers a release

The Release workflow runs automatically on every push to `main` **unless** the commit message contains `chore(release)` — this prevents infinite loops (the release commit itself doesn't trigger another release).

### Manual overrides

If you need to force a specific bump (e.g., promoting to 1.0.0):

```bash
pnpm release:major   # force major bump
pnpm release:minor   # force minor bump
pnpm release:patch   # force patch bump
```

These bypass the commit analysis and use `commit-and-tag-version` directly with the given release type.

### Testing a release locally

```bash
pnpm release -- --dry-run
```

This shows what `commit-and-tag-version` would do (changelog diff, new version number, tag name) without modifying any files.

### Version audit & recovery

If the version ever feels out of sync with the work done (e.g., many features landed but only the patch number moved), you can audit the full release history:

```bash
node scripts/version-audit.mjs
```

This walks every tagged release, recalculates what the bump *should* have been (without the pre-1.0.0 downgrade that was active early on), and compares it against what actually happened. It prints a table showing every mismatch.

To apply the corrected version:

```bash
node scripts/version-audit.mjs --apply
```

This updates `package.json` to the suggested version. After that, `pnpm release` will bump correctly from the new baseline.

---

## Project Structure

Understanding the monorepo layout helps:

```
apps/frontend/          # Angular 21 application
├── src/app/
│   ├── core/           # Guards, interceptors, services
│   ├── features/       # Feature modules (auth, tasks, projects, etc.)
│   ├── shared/         # Reusable components, pipes, directives
│   └── layout/         # App shell

apps/api/               # Fastify backend
├── src/
│   ├── db/             # Database schema and client
│   ├── routes/         # API endpoints
│   ├── plugins/        # Fastify middleware (auth, CORS, etc.)
│   └── lib/            # Shared utilities

packages/shared/        # TypeScript domain types
├── src/
│   ├── auth.ts         # Auth types
│   └── index.ts        # Task types and exports

scripts/dev.mjs         # Local development runner
```

For the Angular component structure, see [ROADMAP.md](./ROADMAP.md#component-structure-recommendations-angular).

---

## API Development Notes

- **Auth**: Uses [Better Auth](https://www.betterauth.dev/)
- **Database**: SQLite via [Drizzle ORM](https://orm.drizzle.team/)
- **API Framework**: [Fastify](https://www.fastify.io/)
- **API Docs**: OpenAPI schema at `pnpm run docs:check` (from `apps/api`)

---

## Questions or Need Help?

- **GitHub Issues**: Open an issue with the `question` label
- **Discussions**: Start a discussion for longer conversations
- **Code Review**: PR reviewers are here to help—ask questions!

---

## Recognition

Contributors are recognized in:
- Commit history (Git)
- PR/issue discussions
- (Optional) Contributors section in README (for major contributions)

---

## Helpful Resources

- [PROJECT_README.md](./PROJECT_README.md) — Setup, scripts, dev environment
- [ROADMAP.md](./ROADMAP.md) — Technical breakdown of all planned features
- [testing.md](./testing.md) — Testing patterns and best practices
- [Conventional Commits](https://www.conventionalcommits.org/) — Commit message style
- [Yotara on GitHub](https://github.com/apauldev/Yotara)

---

**Happy coding! 🚀**
