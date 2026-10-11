# Plan: Semi-automated deploy (`pnpm deploy`)

> Spec for `scripts/deploy.mjs`. Run from the maintainer's machine; verifies the release
> pipeline and deploys a released version to the beta EC2. It never merges, tags, or releases.

## Goal

One command, run from the maintainer's machine, that takes a **merged + released** version
to the beta EC2 safely:

1. Resolve the target release version.
2. Verify the **build** (CI on `main` passed) and **Docker** (the `vX.Y.Z` images are actually
   published).
3. Deploy over SSH — DB backup → compose backup → bump image tags → pull → restart → verify.
4. Print a copy-paste rollback command.

Semi-automated by design: **you merge the PR**; the script verifies the pipeline is green and
deploys.

## Decisions (confirmed)

- **Verify then deploy** — the user merges; the script fails cleanly if the release isn't ready.
  (No waiting/polling, no auto-merge.)
- **EC2 compose only** — edit `/home/ubuntu/docker-compose.hub.yml` in place. The repo's
  `docker-compose.hub.yml` (the `chore(deploy)` pin) is out of scope.

## Deliverables

| File | Change |
|---|---|
| `scripts/deploy.mjs` | **New** — the deploy driver (Node ESM, mirrors `scripts/dev.mjs` / `scripts/release.mjs` style) |
| `package.json` | Add `deploy`, `deploy:check`, `deploy:rollback` scripts |
| `docs/RELEASING.md` | Add a "Deploying a release to beta" section (flow, checks, rollback) |

## Configuration (env-overridable, sane defaults)

| Env | Default | Purpose |
|---|---|---|
| `DEPLOY_HOST` | `yotara` | SSH alias (uses `~/.ssh/config`) |
| `DEPLOY_COMPOSE_FILE` | `/home/ubuntu/docker-compose.hub.yml` | Hub compose on the server |
| `DEPLOY_COMPOSE_DIR` | `/home/ubuntu` | Working dir (for `${...}` from `.env`) |
| `DEPLOY_PROJECT` | `ubuntu` | Compose project name |
| `DEPLOY_API_IMAGE` / `DEPLOY_FRONTEND_IMAGE` | `apauldev2/yotara-api` / `-frontend` | Image repos |
| `DEPLOY_HEALTH_URL` | `https://beta.yotara.website/api/health` | Post-deploy external check |
| `DEPLOY_SSH_OPTS` | `-o BatchMode=yes -o ConnectTimeout=15` | ssh args |

## CLI flags

- `--version vX.Y.Z` — target (default: greatest `v*` tag reachable from `origin/main`).
- `--check` — **read-only**: run all build/docker/registry checks, print the plan, mutate nothing.
- `--dry-run` — alias of `--check`.
- `--yes` — skip the confirmation prompt (enables future unattended use).
- `--no-backup` — skip the DB backup (not recommended).
- `--force` — redeploy even if the target equals the currently deployed version.
- `--rollback` — re-pin to the previously deployed version and bring the stack up.
- `--host <alias>` — override `DEPLOY_HOST`.

## Script flow

### Phase 1 — resolve target version

- `git fetch --tags --force`.
- Default target: `git describe --tags --abbrev=0 origin/main --match "v*"`.
- Fallback: `git tag --list 'v*' --sort=-v:refname | head -1` — **`v:refname` sort**, because a
  plain `git tag --list` is lexicographic and would rank `v0.100.0` below `v0.99.0`.
- `--version` overrides; validate SemVer.

### Phase 2 — verify the build (CI)

- `release_commit = git rev-parse "vX.Y.Z^{commit}"` — the `chore(release):` commit.
- `ci_sha = release_commit^` — the merge commit CI actually ran on. **The release commit has no
  CI run of its own**: the `release` job pushes it with `GITHUB_TOKEN`, and `GITHUB_TOKEN`
  pushes do not trigger workflows. `release.yml` is a `workflow_run` of the CI run on `ci_sha`.
- `gh run list --workflow ci.yml --commit <ci_sha> --limit 1 --json conclusion,url`:
  - `success` → continue;
  - `null` → still running → tell the user "CI in progress on `<sha>`, re-run shortly" and exit
    non-zero (distinct from a failure);
  - anything else → abort with the run URL.
- Scoping to `--workflow ci.yml` avoids CodeQL / secret-scan runs on the same SHA.

### Phase 3 — verify Docker

- **No Release-run lookup by the tag SHA.** The Release run's `head_sha` is `ci_sha` (the parent),
  not the tag commit — a `head_sha = vX.Y.Z^{commit}` lookup silently finds nothing and would
  abort every deploy. Gate on the authoritative signals instead:
  - **GitHub Release exists**: `gh api repos/apauldev/Yotara/releases/tags/vX.Y.Z` → 200. Proves
    the `release` job ran (but *not* that Docker succeeded — it's created before `docker-build`).
  - **Images published**: `GET https://hub.docker.com/v2/repositories/apauldev2/yotara-api/tags/vX.Y.Z`
    and `.../yotara-frontend/tags/vX.Y.Z` → 200, **both**. These manifests only exist once
    `docker-manifest` completes, so they are the real "docker succeeded" gate.
- Optional extra confidence: `gh run list --workflow release.yml --commit <ci_sha>` → `success`.

### Phase 4 — preflight (target)

- `ssh $DEPLOY_HOST true` (reachability).
- Read the currently deployed version: `grep 'apauldev2/yotara-api:' <compose>` → parse `:vX.Y.Z`.
- **No version match / compose missing → abort** with a first-deploy message ("compose not found
  or not version-pinned; deploy once by hand, then re-run"). Never let Phase 6's `sed` run unanchored.
- If `current == target` and not `--force` → print "already on vX.Y.Z" and exit 0.
- Record `current` for rollback (also embedded in the compose backup name).

### Phase 5 — DB backup (unless `--no-backup`)

- Read local `scripts/ec2-backup.sh`, **normalize `\r\n` → `\n`** (avoids the CRLF breakage we
  hit), pipe it to the host, run with retention off:
  ```
  ssh $DEPLOY_HOST "cat > /tmp/yotara-backup.sh"   < normalized script
  ssh $DEPLOY_HOST "RETENTION_DAYS=0 bash /tmp/yotara-backup.sh"
  ```
  (`RETENTION_DAYS=0` → the script's `find … -delete` block is skipped, so **all existing
  backups are preserved**.)
- Assert output contains `integrity_check ok`; **abort before any compose change** otherwise.

### Phase 6 — deploy

- Backup compose: `cp <compose> <compose>.bak.<UTC>`.
- Bump tags in place, anchored on the recorded `current` version, **with the dots escaped** in the
  regex (`0\.79\.2`, not `0.79.2`):
  ```
  sed -i 's#apauldev2/yotara-api:v0\.79\.2#apauldev2/yotara-api:v0.79.3#;
          s#apauldev2/yotara-frontend:v0\.79\.2#apauldev2/yotara-frontend:v0.79.3#' <compose>
  ```
- `cd <compose dir> && docker compose -f <compose> pull` — **abort on failure** (never restart onto
  stale/partial images).
- Restart **frontend first, then api** — realip (nginx) must be live before the api's signup-only
  ban behaviour:
  ```
  docker compose -f <compose> up -d --no-deps frontend
  docker compose -f <compose> up -d api
  ```

### Phase 7 — verify

- Derive container IDs from the compose (don't hardcode `ubuntu-frontend-1`):
  `docker compose -f <compose> ps -q frontend` / `... ps -q api`.
- `docker exec <frontend-id> ls /etc/nginx/conf.d` → contains `realip.conf` (guards the image-baked
  realip fix).
- `docker exec <frontend-id> nginx -t` → ok.
- `docker exec <api-id> wget -qO- http://127.0.0.1:3000/health` → `{"status":"ok",…}`
  (**127.0.0.1, not `localhost`** — see issue #402).
- Optional external: `curl $DEPLOY_HEALTH_URL` → 200.
- Print: deployed version, backup path, and the rollback command.

### Phase 8 — rollback (`--rollback`)

- Select the newest `<compose>.bak.*` **strictly older than the current deploy**, sorted by the UTC
  timestamp suffix. **If none exists → abort** and print the manual recipe (don't guess).
- Re-pin the tags, `docker compose -f <compose> pull` (a `docker image prune` may have dropped the
  old per-arch images — `up` alone could re-pull or fail), `up -d` (frontend first, then api), verify.
- **Scope:** restores **code only**, not the DB. Migrations are additive, so old code ignores newer
  columns/tables — usually safe, but state it in the output.

## package.json

```json
"deploy": "node scripts/deploy.mjs",
"deploy:check": "node scripts/deploy.mjs --check",
"deploy:rollback": "node scripts/deploy.mjs --rollback"
```

## Review Focus

The non-obvious spots a reviewer should check — each is deliberate:

1. **Phase 2 keys off `tag^{commit}^`, not the tag SHA.** The release commit has no CI run
   (`GITHUB_TOKEN` push suppresses triggers); CI ran on its parent, which is what `release.yml` is a
   `workflow_run` of. Verified: `v0.79.3` → `95fafcd` (`chore(release): 0.79.3`), parent `51e327a`,
   and the `Release` run's `head_sha` is `51e327a`.
2. **Phase 3 has no Release-run-by-SHA check** for the same reason — a tag-SHA lookup finds nothing
   and would abort every deploy. GitHub Release + Docker Hub tags cover it.
3. `conclusion: null` is "still running", surfaced distinctly from a failure.
4. Version fallback uses `--sort=-v:refname` (lexicographic would break at `v0.100.0`).
5. `sed` anchors on the recorded `current` version with **escaped dots**, and aborts if the compose
   has no version (first deploy).
6. Container IDs come from `docker compose ps -q <service>`, never hardcoded names.
7. Rollback: timestamp-sorted `.bak` selection, an explicit re-pull, and the "code, not schema" caveat.

## Global constraints

- Read-only until the target version is confirmed released; `--check` never mutates anything.
- Frontend (realip) restarts **before** api (signup-only ban) on every deploy and rollback.
- All DB backups preserved (`RETENTION_DAYS=0`).
- No auto-merge, no tag or release creation.

## Verification of the tooling

- `pnpm deploy:check` against the live `v0.79.3` → passes all checks and reports "already on v0.79.3".
- `pnpm deploy --version v0.78.0 --check` → prints the plan for a downgrade (no mutation).
- Full `pnpm deploy` on the next release (with `--yes` optional).

## Out of scope / follow-ups

- Updating the checked-in `docker-compose.hub.yml` (`chore(deploy)` pin) — deliberately excluded.
- Fully unattended deploy (a `workflow_run` on Release hitting a deploy key/runner) — the `--yes`
  flag is the hook for this later.
- Fixing the underlying `localhost`↔IPv6 health bug (#402) — the script sidesteps it with
  `127.0.0.1`; the scripts themselves are tracked in #402.

## Risks / notes

- Requires `gh` authed (it is: `apauldev`) and network access to GitHub + Docker Hub.
- Requires the `yotara` SSH alias/keys (present in `~/.ssh/config`).
- The script edits the server compose in place; the `sed` anchors on
  `apauldev2/yotara-{api,frontend}:<current>`, so it stays correct even as other compose lines change.
