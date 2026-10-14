# Deploy Automation (`pnpm deploy`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A maintainer-run `pnpm deploy` that verifies a merged+released version is fully published (CI green, images on Docker Hub) and then deploys it to the beta EC2 over SSH with backup, verification, and a printed rollback command.

**Architecture:** Node ESM CLI driver (`scripts/deploy.mjs`, thin orchestration mirroring `scripts/release.mjs` style) plus a pure, unit-tested logic module (`scripts/deploy-logic.mjs`, `node:test`). Git/gh via `execSync`, SSH via `spawnSync` with an args array (stdin piped for the backup script), Docker Hub checks via global `fetch`. Zero new npm dependencies.

**Tech Stack:** Node ≥ 22.22.3 builtins only (`node:child_process`, `node:readline`, `node:test`, `node:assert`), pnpm scripts, gh CLI, ssh.

**Spec:** [`docs/deploy-automation-plan.md`](../../deploy-automation-plan.md) — the maintainer's confirmed spec, committed on this branch. All phases, flags, env vars, guardrails, and its Review Focus items come from there.

## Global Constraints

- Zero new npm dependencies; Node builtins only (repo scripts convention).
- Read-only until the target version is confirmed released; `--check`/`--dry-run` never mutates anything (local or remote).
- Frontend (realip) restarts **before** api on every deploy and rollback.
- All DB backups preserved (`RETENTION_DAYS=0`); abort before any compose change if the backup fails.
- No auto-merge, no tag or release creation, no waiting/polling for CI.
- Conventional Commits; every commit verified by the task's test command.

## Review Focus

Inherited from the spec (its Review Focus items 1–7), plus decisions this plan pins:

1. Phase 2 keys off `tag^{commit}^` (the release commit has no CI run — GITHUB_TOKEN pushes don't trigger workflows).
2. No Release-run-by-tag-SHA lookup; GitHub Release + Docker Hub tags are the Docker gate.
3. `conclusion: null` → distinct "CI in progress" message, non-zero exit.
4. Version fallback uses `--sort=-v:refname` (lexicographic breaks at `v0.100.0`).
5. `sed` anchors on recorded `current` with escaped dots; aborts on missing version (first deploy).
6. Container IDs from `docker compose ps -q <service>`, never hardcoded.
7. Rollback: timestamp-sorted `.bak` selection, explicit re-pull, "code, not schema" caveat.
8. `--rollback --check` is a read-only preview; rollback backs up the current compose before re-pinning (rollback is itself reversible).
9. External health check (`DEPLOY_HEALTH_URL`) is warn-only; container-level checks are authoritative.
10. Root test wiring uses a quoted glob (`node --test "scripts/*.test.mjs"`): the directory form fails on Node 24 and PowerShell does not expand unquoted globs.

---

### Task 1: Deploy logic module + test suite

**Files:**
- Create: `scripts/deploy-logic.mjs`
- Test: `scripts/deploy.test.mjs`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (exact exports of `scripts/deploy-logic.mjs`):
  - `escapeSedRegex(value: string): string` — escapes sed-BRE metacharacters `\. * [ ] ^ $ #` and backslash.
  - `isValidVersion(version: string): boolean` — `/^v?\d+\.\d+\.\d+$/`.
  - `parseDeployedVersion(grepLine: string, apiImage: string): string | null` — returns `vX.Y.Z` from a compose grep line, else null.
  - `resolveTargetVersion({ override?, describeResult?, sortedTags: string[] }): { version: string, source: 'override' | 'describe' | 'tag-list' }` — throws on invalid override or empty inputs.
  - `classifyCiRuns(runs: Array<{ conclusion: string | null, url: string }>): { status: 'success' | 'in-progress' | 'failed' | 'missing', url?: string }` — first run wins (gh returns latest first); `conclusion: null` = in-progress; empty array = missing.
  - `buildTagBumpScript({ current, target, apiImage, frontendImage }): string` — a two-expression `sed -i` command string (no file argument) using `#` delimiter and `escapeSedRegex` on both versions.
  - `selectRollbackBackup(backupNames: string[], currentStamp: string): string | null` — names look like `docker-compose.hub.yml.bak.2026-10-11T061358Z`; returns the basename with the newest stamp strictly less than `currentStamp` (string comparison; stamps are fixed-width UTC), else null.
  - `backupSucceeded(output: string): boolean` — `includes('integrity_check ok') && !includes('integrity_check FAILED')`.
  - `normalizeLineEndings(text: string): string` — `\r\n` → `\n`.

- [ ] **Step 1: Write the failing tests**

`scripts/deploy.test.mjs` with `node:test`/`node:assert` covering at minimum:

- `escapeSedRegex`: `escapeSedRegex('v0.79.3')` → `'v0\\.79\\.3'`; `buildTagBumpScript({current:'v0.79.2',target:'v0.79.3',apiImage:'apauldev2/yotara-api',frontendImage:'apauldev2/yotara-frontend'})` contains `s#apauldev2/yotara-api:v0\.79\.2#apauldev2/yotara-api:v0\.79\.3#` and the frontend expression.
- `isValidVersion`: `v0.79.3`/`0.79.3` true; `v0.79`, `v0.79.3-rc.1`, `` false.
- `parseDeployedVersion`: from `    image: apauldev2/yotara-api:v0.79.3` with apiImage `apauldev2/yotara-api` → `'v0.79.3'`; from a frontend line → null; from text without image → null.
- `resolveTargetVersion`: override `'v1.2.3'` wins over describe/tags, source `'override'`; describe `'v0.79.3\n'` trimmed, source `'describe'`; no override/describe → `sortedTags[0]`, source `'tag-list'`; invalid override `'banana'` throws.
- `classifyCiRuns`: `[{conclusion:'success',url:'u'}]` → success; `[{conclusion:null,url:'u'}]` → in-progress; `[{conclusion:'failure',url:'u'}]` → failed with url; `[]` → missing.
- `selectRollbackBackup`: `['x.bak.2026-10-10T100000Z','x.bak.2026-10-11T060000Z']` with currentStamp `'2026-10-11T061358Z'` → `'x.bak.2026-10-11T060000Z'`; only equal-or-newer stamps → null; empty list → null.
- `backupSucceeded`: `'[verify] integrity_check ok'` → true; `'[verify] integrity_check FAILED'` → false; unrelated output → false.
- `normalizeLineEndings`: `'a\r\nb\r\n'` → `'a\nb\n'`; `'a\nb'` unchanged.
- v0.100.0 regression pin: `resolveTargetVersion({sortedTags:['v0.100.0','v0.99.0']})` → `v0.100.0` (assumes `--sort=-v:refname` ordering, documented in the test name).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "scripts/deploy.test.mjs"`
Expected: FAIL — module-not-found for `./deploy-logic.mjs`.

- [ ] **Step 3: Implement `scripts/deploy-logic.mjs`**

Implement exactly the exported signatures above. Sed escaping: `String(value).replace(/[\\.*^$#[\]]/g, '\\$&')`. Everything else is straightforward string/regex work; no I/O.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "scripts/deploy.test.mjs"`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy-logic.mjs scripts/deploy.test.mjs
git commit -m "feat: add deploy logic helpers with unit tests"
```

---

### Task 2: Deploy driver — CLI, config, verification phases 1–4, package.json scripts

**Files:**
- Create: `scripts/deploy.mjs`
- Modify: `package.json` (root: add `deploy`, `deploy:check`, `deploy:rollback`, `test:scripts`)

**Interfaces:**
- Consumes: every export of `scripts/deploy-logic.mjs` (Task 1).
- Produces: the `pnpm deploy` / `pnpm deploy:check` CLI; phases 5–7 and 8 arrive in Tasks 3–4 behind the same confirmation gate.

- [ ] **Step 1: Write `scripts/deploy.mjs` phases 1–4 + check mode**

Mirror `scripts/release.mjs` conventions (`#!/usr/bin/env node`, `run()` via `execSync`, section banners, plain `console.log`).

- Flags via `node:util` `parseArgs`: `--version`, `--check`, `--dry-run` (alias of check), `--yes`, `--no-backup`, `--force`, `--rollback`, `--host`, `--help`.
- Config from env with the spec's exact defaults: `DEPLOY_HOST=yotara`, `DEPLOY_COMPOSE_FILE=/home/ubuntu/docker-compose.hub.yml`, `DEPLOY_COMPOSE_DIR=/home/ubuntu`, `DEPLOY_PROJECT=ubuntu`, `DEPLOY_API_IMAGE=apauldev2/yotara-api`, `DEPLOY_FRONTEND_IMAGE=apauldev2/yotara-frontend`, `DEPLOY_HEALTH_URL=https://beta.yotara.website/api/health`, `DEPLOY_SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15` (split on whitespace into the ssh args array). `--host` overrides `DEPLOY_HOST`.
- Phase 1: `git fetch --tags --force` (abort on failure); `git describe --tags --abbrev=0 origin/main --match "v*"` (catch → null); fallback `git tag --list "v*" --sort=-v:refname` first line; `resolveTargetVersion` with `--version` override; print target + source.
- Phase 2: `sha = git rev-parse "<tag>^{commit}^"`; `gh run list --workflow ci.yml --commit <sha> --limit 1 --json conclusion,url`; `classifyCiRuns` → in-progress prints "CI in progress on `<sha>`, re-run shortly" (exit 3); failed/missing aborts with the run URL (exit 1).
- Phase 3: `gh api repos/apauldev/Yotara/releases/tags/<tag> --silent` must exit 0 (GitHub Release exists); `fetch` both `https://hub.docker.com/v2/repositories/<image>/tags/<tag>` must be 200; abort listing missing tags.
- Phase 4: `ssh <host> true` (abort with the ssh error if unreachable); `grep '<apiImage>:' <compose>` remotely → `parseDeployedVersion`; null → abort with the first-deploy message ("compose not found or not version-pinned; deploy once by hand, then re-run"); `current == target && !--force` → print "already on <version>", exit 0; else print the deploy plan (host, current → target, what will run).
- `--check`/`--dry-run`: run phases 1–4, print the plan, exit 0. Nothing mutating is executed (ssh reachability and remote grep are reads; `git fetch` is local-only).
- After phase 4 in deploy mode: unless `--yes`, `node:readline` confirmation `Deploy <target> to <host> (current <current>)? [y/N]` — anything but y/Y aborts (exit 1). Tasks 3–4 extend the flow after this point.

- [ ] **Step 2: Wire package.json scripts**

Add to root `package.json` scripts: `"deploy": "node scripts/deploy.mjs"`, `"deploy:check": "node scripts/deploy.mjs --check"`, `"deploy:rollback": "node scripts/deploy.mjs --rollback"`, `"test:scripts": "node --test \"scripts/*.test.mjs\""`. (Root `test` is extended in Task 4, after its suite is complete.)

- [ ] **Step 3: Syntax check + negative-path unit sanity**

Run: `node --check scripts/deploy.mjs && pnpm test:scripts`
Expected: no syntax error; Task 1 suite still green.

- [ ] **Step 4: Live read-only verification (the spec's own scenarios)**

Run: `pnpm deploy:check --version v0.79.3`
Expected: all checks pass, reports "already on v0.79.3", exit 0.

Run: `pnpm deploy:check --version v0.999.0`
Expected: aborts in phase 3 with missing Docker Hub tags listed (read-only negative path).

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy.mjs package.json
git commit -m "feat: add deploy driver with release verification"
```

---

### Task 3: Deploy execution phases 5–7 (backup, bump, restart, verify)

**Files:**
- Modify: `scripts/deploy.mjs`

**Interfaces:**
- Consumes: Task 1 helpers (`backupSucceeded`, `normalizeLineEndings`, `buildTagBumpScript`, `parseDeployedVersion`), Task 2 config/CLI/confirmation gate.
- Produces: `deployToHost()` flow executed after confirmation; Phase 7 `verifyStack()` reused by rollback (Task 4).

- [ ] **Step 1: Implement phases 5–7 after the confirmation gate**

- Phase 5 (skip with a warning when `--no-backup`): read `scripts/ec2-backup.sh`, `normalizeLineEndings`, `spawnSync('ssh', [...sshOpts, host, 'cat > /tmp/yotara-backup.sh'], { input })`; then run `RETENTION_DAYS=0 bash /tmp/yotara-backup.sh` remotely; `backupSucceeded(output)` false → print output tail, abort (exit 1) **before any compose change**. Record the backup path from the `-> <path>.db` output line for the summary.
- Phase 6 (compose timestamp stamp `YYYY-MM-DDTHHmmssZ`, e.g. `new Date().toISOString().replace(/:/g, '').replace(/\.\d+Z/, 'Z')`):
  - `cp <compose> <compose>.bak.<stamp>` on the host;
  - apply `buildTagBumpScript({current, target, ...})` + compose path via `sed -i` on the host;
  - post-sed assertion: remote `grep '<apiImage>:<target>' <compose>` must succeed, else abort (belt-and-braces the anchored sed);
  - `cd <dir> && docker compose -f <file> pull` — abort on non-zero (exit 1) with a "stale/partial images" message;
  - `docker compose -f <file> up -d --no-deps frontend`, then `docker compose -f <file> up -d api` — abort on non-zero.
- Phase 7 (shared helper `verifyStack()`): `frontendId = compose ps -q frontend`, `apiId = compose ps -q api` (abort if either is empty); `docker exec <frontendId> ls /etc/nginx/conf.d` must contain `realip.conf`; `docker exec <frontendId> nginx -t` exit 0; `docker exec <apiId> wget -qO- http://127.0.0.1:3000/health` must contain `"status":"ok"` (127.0.0.1, not localhost — #402); external `fetch(DEPLOY_HEALTH_URL)` non-200 → **warn only**. Print summary: deployed version, backup path, and the rollback command `pnpm deploy:rollback`.

- [ ] **Step 2: Verify no regression in check mode + syntax**

Run: `node --check scripts/deploy.mjs && pnpm test:scripts && pnpm deploy:check --version v0.79.3`
Expected: syntax OK, suite green, check mode still passes (phases 5–7 are unreachable in `--check`).

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.mjs
git commit -m "feat: add deploy execution and verification phases"
```

---

### Task 4: Rollback flow (phase 8) + root test wiring

**Files:**
- Modify: `scripts/deploy.mjs`, `package.json` (root `test`)

**Interfaces:**
- Consumes: `selectRollbackBackup`, `parseDeployedVersion`, `buildTagBumpScript`; `verifyStack()` from Task 3.
- Produces: `pnpm deploy:rollback` (and `--rollback --check` read-only preview).

- [ ] **Step 1: Implement `--rollback` flow**

- Reachability + current version via the same phase-4 logic.
- Remote `ls <compose>.bak.*` → basenames; none → abort printing the manual recipe (read the newest backup by hand, restore, `docker compose up -d`).
- `currentStamp` = newest existing backup's stamp; `target = selectRollbackBackup(names, currentStamp)`; null → abort with the same manual recipe (nothing strictly older).
- Rollback version = `parseDeployedVersion(remote grep of the selected backup file)` — parsed from the backup's content, not its filename; null → abort with the manual recipe.
- Before mutating: `cp <compose> <compose>.bak.<newStamp>` (rollback is reversible).
- Re-pin via `buildTagBumpScript({ current: <current>, target: <rollbackVersion> })`, assert post-sed, `docker compose pull` (explicit re-pull — old per-arch images may have been pruned), `up -d --no-deps frontend` then `up -d api`, then `verifyStack()`.
- Print the "code only, not DB schema — migrations are additive; old code ignores newer columns" caveat.
- `--rollback --check`: print the whole plan (selected backup, version, commands) and exit 0 without mutating.

- [ ] **Step 2: Wire root `test`**

Change root `package.json`: `"test": "pnpm -r test && pnpm test:scripts"`.

- [ ] **Step 3: Verify**

Run: `pnpm test:scripts` → green (this is the task's suite).
Run: `pnpm deploy:rollback --version v0.79.3 --check` (read-only) → prints the rollback plan selecting the newest backup strictly older than the current deploy, no mutation.
Run: `pnpm -r test` → the api/frontend suites still pass (unchanged by this branch; failing only for pre-existing environment reasons must be reported, not worked around).

- [ ] **Step 4: Commits**

```bash
git add scripts/deploy.mjs
git commit -m "feat: add deploy rollback flow"
git add package.json
git commit -m "chore: run script tests in root test"
```

---

### Task 5: Docs — RELEASING.md "Deploying a release to beta"

**Files:**
- Modify: `docs/RELEASING.md`

**Interfaces:**
- Consumes: the finished CLI (flags, env vars, behaviors from Tasks 2–4).
- Produces: nothing code-wise.

- [ ] **Step 1: Add the deploy section**

After the release-pipeline content, add `## Deploying a release to beta` covering: the flow (verify → backup → bump → pull → restart frontend-first → verify), the env table (exact defaults from the spec), the flags table, the guardrails (`--check` read-only, abort conditions, backups preserved), `pnpm deploy:rollback` + the code-not-schema caveat, and the first-deploy note (compose must be version-pinned by hand once). Keep the doc's existing tone and heading depth.

- [ ] **Step 2: Verify formatting**

Run: `pnpm exec prettier --check docs/RELEASING.md scripts/deploy.mjs scripts/deploy-logic.mjs scripts/deploy.test.mjs`
Expected: all files pass (fix with `--write` if not, before committing).

- [ ] **Step 3: Commit**

```bash
git add docs/RELEASING.md
git commit -m "docs: add beta deploy guide to RELEASING"
```
