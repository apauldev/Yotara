# Releasing Yotara

This document describes how to create a new release of Yotara.

## Overview

Yotara uses [Semantic Versioning](https://semver.org/) with [Conventional Commits](https://www.conventionalcommits.org/). The release process is automated via:

- **Commitlint**: enforces conventional commit messages
- **Custom release script** (`scripts/release.mjs`): analyzes commits and determines bump type
- **commit-and-tag-version**: generates changelog, creates version commit and tag
- **GitHub Actions**: publishes GitHub releases on tag push

## Version Bumping Rules

| Commit Type | Bump | Example |
|:---|:---|:---|
| `fix:` | Patch | `0.58.4` → `0.58.5` |
| `feat:` | Minor | `0.58.4` → `0.59.0` |
| `feat!:` or `fix!:` | Major | `0.58.4` → `1.0.0` |
| `docs:`, `chore:`, `refactor:`, `test:` | Patch | `0.58.4` → `0.58.5` |

Note: The custom script disables the `preMajor` downgrade that `conventional-changelog` applies when version < 1.0.0, so `feat:` correctly produces a minor bump even during pre-1.0 development.

## Release Commands

### Dry run (preview)

```bash
pnpm release -- --dry-run
```

This shows what would happen without changing any files.

### Standard release

```bash
pnpm release
```

This will:
1. Analyze all commits since the last tag
2. Determine the bump type (major/minor/patch)
3. Generate `CHANGELOG.md`
4. Bump version in `package.json`
5. Create a version commit: `chore(release): vX.Y.Z`
6. Create a git tag `vX.Y.Z`

### Manual overrides

```bash
pnpm release:major   # Force major bump
pnpm release:minor   # Force minor bump
pnpm release:patch   # Force patch bump
```

These use `commit-and-tag-version` directly (without the custom analysis).

## What Happens After a Release

1. **Tag push**: When you push the tag to GitHub, the CI/CD pipeline:
   - Creates a GitHub Release with the generated changelog
   - Attaches build artifacts
   - Publishes the release

2. **Auto-merge**: The release workflow creates a PR back to `main` with version bumps.

## Step-by-Step Release Process

### 1. Ensure main is clean

```bash
git checkout main
git pull origin main
```

### 2. Run verification

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

All checks must pass before releasing.

### 3. Preview the release

```bash
pnpm release -- --dry-run
```

Review the output:
- Verify the bump type is correct
- Check the changelog entries make sense
- Confirm the new version number

### 4. Create the release

```bash
pnpm release
```

### 5. Push to GitHub

```bash
git push origin main --follow-tags
```

The `--follow-tags` flag pushes both the commit and the tag.

### 6. Verify the release

- Check the GitHub Actions workflow completed successfully
- Verify the GitHub Release was created at https://github.com/apauldev/Yotara/releases

## Troubleshooting

### "Tag already exists on remote"

If the release script reports that the tag already exists on the remote, the release was already completed. The script will exit cleanly.

### "No new commits since last release"

There are no qualifying commits (feat, fix, etc.) since the last tag. Either:
- Wait for more changes to land
- Use `pnpm release:patch` to force a bump

### Failed release (partial)

If the release fails partway through:
1. Check what was created: `git tag -l "v*"`
2. If the tag exists locally but wasn't pushed, delete it: `git tag -d vX.Y.Z`
3. If the tag was pushed, the release is complete — don't delete remote tags

### CI workflow failed after push

If the GitHub Actions workflow fails after you pushed the tag:
1. Check the workflow logs
2. Fix the issue
3. Delete the remote tag: `git push origin :refs/tags/vX.Y.Z`
4. Delete the local tag: `git tag -d vX.Y.Z`
5. Re-run the release

## Commit Message Examples

```bash
# Feature (minor bump)
git commit -m "feat(tasks): add recurring task support"

# Bug fix (patch bump)
git commit -m "fix(auth): resolve session expiry race condition"

# Breaking change (major bump)
git commit -m "feat(api)!: change task status enum values

BREAKING CHANGE: Task status values have been renamed."
```

## Changelog

The changelog is automatically generated from commit messages and stored in `CHANGELOG.md`. It follows the [Keep a Changelog](https://keepachangelog.com/) format.
