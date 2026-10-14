# Releasing Yotara

How releases work, and what to do when one goes wrong.

## Overview

Releases are **automated**. Nobody runs release commands by hand for a normal
release: merging to `main` is the trigger.

Yotara uses [Semantic Versioning](https://semver.org/) driven by
[Conventional Commits](https://www.conventionalcommits.org/). The moving parts:

- **commitlint** — enforces conventional commit messages on commit
- **[`scripts/release.mjs`](../scripts/release.mjs)** — analyzes commits since the
  last tag and decides the bump type
- **commit-and-tag-version** — generates the changelog, bumps `package.json`,
  commits, and tags
- **[`.github/workflows/release.yml`](../.github/workflows/release.yml)** — runs
  the release and publishes images

## Version bumping rules

| Commit Type | Bump | Example |
|:---|:---|:---|
| `fix:`, `docs:`, `refactor:`, `test:`, `perf:`, `build:`, `ci:`, `style:`, `chore:` | Patch | `0.58.4` → `0.58.5` |
| `feat:` | Minor | `0.58.4` → `0.59.0` |
| `feat!:` or `fix!:` (or a `BREAKING CHANGE:` footer) | Major | `0.58.4` → `1.0.0` |

The custom script disables the `preMajor` downgrade that
`conventional-changelog` normally applies below 1.0.0, so `feat:` correctly
produces a minor bump during pre-1.0 development.

**Only two commit prefixes are ignored:** `chore(release):` and `chore(deploy):`.
Every other `chore:` commit produces a patch release. Those two prefixes exist so
the release and deploy commits do not themselves trigger another release.

## What happens on merge to `main`

`release.yml` is triggered by `workflow_run` — it starts only after **CI
completes successfully on `main`**. It does not trigger on a tag push, and no tag
push is needed.

It skips entirely when the commit that triggered CI starts with
`chore(release):` or `chore(deploy):`, which is what prevents a release loop.

### Job: `release`

1. Installs dependencies
2. Runs `pnpm release`, which analyzes commits, generates `CHANGELOG.md`, bumps
   the version, creates a `chore(release): vX.Y.Z` commit, and creates the tag
3. Reads the new version and the release SHA
4. Pushes directly to `main` with `git push --follow-tags origin HEAD:main` —
   **there is no pull request and no auto-merge step**
5. Creates the GitHub Release at tag `vX.Y.Z`, using the **full `CHANGELOG.md`**
   as the release body via `body_path`. No build artifacts are attached.

### Jobs: `docker-build` and `docker-manifest`

`docker-build` builds the API and frontend images for `linux/amd64` and
`linux/arm64` on native runners and pushes per-architecture tags.
`docker-manifest` then combines them into multi-platform manifests:

- `apauldev2/yotara-api` and `apauldev2/yotara-frontend`
- Tagged `X.Y.Z`, `vX.Y.Z`, and `latest`

Publishing requires the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository
secrets.

## Running a release manually

Use `workflow_dispatch` on `release.yml` when you need to release without a
fresh merge — for example after fixing a broken release step.

**Do not** run `pnpm release` locally and push the result unless you are
deliberately bypassing the pipeline. Doing so races the automation.

### Previewing locally

`pnpm release -- --dry-run` prints the analysis and the version it would produce
without changing anything. This is safe and useful for checking that your commit
messages will produce the bump you expect.

### Forcing a bump type

These call `commit-and-tag-version` directly, bypassing the commit analysis:

```bash
pnpm release:major
pnpm release:minor
pnpm release:patch
```

## Deploying a release to beta

Once a release is merged and its images are published, deploy it to the beta EC2 from your
machine with one command:

```bash
pnpm run deploy            # verify + deploy the newest v* tag on origin/main
pnpm run deploy --check    # verify only — prints the plan, mutates nothing
pnpm run deploy --version v0.79.3
pnpm run deploy:rollback   # re-pin to the previously deployed version
```

`pnpm run deploy` **verifies before it touches anything**. It requires a verified GitHub Release and
both published image tags; inability to verify the Release aborts rather than warning and continuing.

The deploy then:

1. **Build** — CI on `main` passed for the release's parent commit (`vX.Y.Z^{commit}^`). The
   `chore(release):` commit itself has no CI run, because the release job pushes it with
   `GITHUB_TOKEN` (which does not trigger workflows).
2. **Docker** — the GitHub Release exists **and** both `apauldev2/yotara-{api,frontend}:vX.Y.Z`
   tags are published on Docker Hub. Those tags only appear after `docker-manifest`, so they are
   the real gate.
3. **Target** — the compose on the host is version-pinned, and the current version is read from it.

It then takes a WAL-safe DB backup (retention disabled, so every existing backup is kept), backs
up the compose, bumps both image tags, and pulls images. If pulling fails, it restores the previous
compose file and stops before restarting services. Compose uses the configured project name and
working directory consistently. It restarts **frontend first (realip) then api**, and verifies
`realip.conf` is present, `nginx -t` passes, and
`127.0.0.1:3000/health` returns ok (polling for up to 60 seconds/60 attempts). The optional external
health URL remains warning-only.

### Environment overrides

| Var | Default | Purpose |
|:---|:---|:---|
| `DEPLOY_HOST` | `yotara` | SSH alias |
| `DEPLOY_COMPOSE_FILE` | `/home/ubuntu/docker-compose.hub.yml` | Hub compose on the host |
| `DEPLOY_COMPOSE_DIR` | `/home/ubuntu` | Working dir (for `${...}` from `.env`) |
| `DEPLOY_PROJECT` | `ubuntu` | Explicit Docker Compose project name |
| `DEPLOY_API_IMAGE` / `DEPLOY_FRONTEND_IMAGE` | `apauldev2/yotara-api` / `-frontend` | Image repos |
| `DEPLOY_HEALTH_URL` | `https://beta.yotara.website/api/health` | Post-deploy external check |
| `DEPLOY_SSH_OPTS` | `-o BatchMode=yes -o ConnectTimeout=15` | ssh args |

### Guardrails

- `--check` is fully read-only (verification + plan; no SSH mutation, no backup).
- Aborts before changing anything if the GitHub Release cannot be verified, CI isn't green, either
  published image is missing, the API/frontend compose tags are missing or unequal, the DB backup
  fails its integrity check, or the compose isn't version-pinned (the first deploy must be pinned by
  hand once).
- `--no-backup` skips the DB backup (not recommended); `--yes` skips the prompt (for unattended
  runs); `--force` redeploys the current version.

### Rollback

`pnpm run deploy:rollback` re-pins to the newest compose backup with a version different from
the currently deployed version, skipping same-version snapshots left by failed or forced deploys.
It re-pulls, restarts, and verifies. It restores **code only** — the DB schema is not reverted
(migrations are additive, so old code ignores newer columns/tables). It backs up the current
compose first, so a rollback is itself reversible.

## Troubleshooting

### "Tag already exists on remote"

The release was already completed. The script exits cleanly; nothing to do.

### "No new commits since last release"

There are no qualifying commits since the last tag. Either wait for more changes
or use `pnpm release:patch` to force a bump.

### The release job fails after the version commit landed

The version-bump commit and tag may already be on `main`.

1. Check the workflow logs.
2. **Re-run the failed job.** GitHub Actions re-runs retry the failed step
   without producing a new version bump.
3. If re-running is not possible, re-run the whole workflow with
   `workflow_dispatch`.

Do **not** run `pnpm release` again on your machine — it would analyze commits
since the new tag and produce a second bump.

### The release is wrong and must be redone

Only do this when the tag points at the wrong commit:

```bash
git push origin :refs/tags/vX.Y.Z   # delete the remote tag
git tag -d vX.Y.Z                   # delete the local tag
git revert HEAD --no-edit           # revert the version-bump commit
git push origin main
```

Then trigger the workflow again.

### Docker publishing fails

The version bump and GitHub Release are already done, so the release exists —
only the images are missing. Fix the cause (usually a missing or expired
`DOCKERHUB_TOKEN`), then re-run the `docker-build` and `docker-manifest` jobs
from the failed run.

## Commit message examples

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

`CHANGELOG.md` is generated from commit messages by commit-and-tag-version and
follows the [Keep a Changelog](https://keepachangelog.com/) format. Do not edit it
by hand — your changes will be overwritten at the next release.
