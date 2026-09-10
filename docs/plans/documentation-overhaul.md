# Documentation Overhaul Plan

> **Status:** Proposed — not started.
> **Date:** 2026-09-10
> **Scope:** every human-facing Markdown file in the repository (24 files, ~9,040 lines).
> **Audience:** maintainers executing this plan.

## 1. Summary

The documentation has a strong core — `README.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, and `DOCKER.md` are genuinely well written — but that core is buried under ~4,900 lines of superseded plans, self-declared historical snapshots, and duplicated setup instructions. Worse, the four documents that *are* canonical each contain at least one confident, specific, and now-false claim.

Three problems, in priority order:

1. **Factual drift in canonical docs.** Nine verified errors across six files, including a security-relevant claim in `docs/ARCHITECTURE.md` and an incorrect release process in `docs/RELEASING.md`.
2. **No information architecture.** There is no docs index, two `CONTRIBUTING.md` files that contradict each other, setup instructions in six places, and no single source of truth for environment variables.
3. **Historical material treated as current.** `ROADMAP.md` (779 lines) plus eleven other files describe shipped, abandoned, or never-started work in the same voice as live documentation.

### Aim

A doc set where a new contributor, a self-hoster, and a returning maintainer can each find the one document that owns their question, and where every factual claim is either verified by CI or clearly dated.

### Method and evidence basis

Every claim below was verified against source, configuration, and CI — not against other docs. Proof paths are cited inline. Two caveats:

- I could not query the live GitHub Project board, so board-snapshot staleness is judged against shipped code and `CHANGELOG.md` rather than the board itself.
- Line numbers were accurate at the time of writing and may shift as edits land.

---

## 2. Structural problems

These five issues cause the drift; fixing them is worth more than fixing individual sentences.

### S1 — There is no documentation index

`docs/` contains 11 `.md` files and no `README.md`. Nothing links them together except a prose paragraph in `docs/ARCHITECTURE.md` ("Planning and documentation policy") that assigns ownership. A reader landing in `docs/` has no way to know which of eleven files is current.

**Remediation:** add `docs/README.md` as an index with a one-line purpose, audience, and status for every doc. This is also the natural home for the ownership table in §6.

### S2 — Two `CONTRIBUTING.md` files, with different content and conflicting requirements

`CONTRIBUTING.md` (208 lines) and `docs/CONTRIBUTING.md` (96 lines) are both presented as the contributor guide. They do not duplicate each other so much as disagree:

| Topic | `CONTRIBUTING.md` (root) | `docs/CONTRIBUTING.md` |
|:---|:---|:---|
| Contribution agreement | CLA — "CLAassistant will prompt you automatically" | DCO — "Sign-off your commits with `git commit -s`" |
| Test file location | `apps/api/src/**/*.test.ts` (correct) | `apps/api/test/routes/<resource>.test.ts` (wrong — tests are colocated under `src/`) |
| Frontend features list | `auth, error, onboarding, personal, shell, tasks` (correct) | `auth, personal, team, onboarding` (lists a `team` feature that does not exist) |

Two different legal agreements documented for the same repository is the most serious item in this plan. `CLA.md` exists at the root and there is no CLAassistant configuration, workflow, or app reference anywhere in the repo — only the prose claim and a historical `CHANGELOG.md` entry.

**Remediation:** merge, do not keep both. Root `CONTRIBUTING.md` is what GitHub surfaces, so it is the survivor; port over the genuinely unique material from `docs/CONTRIBUTING.md` (§3.4), then delete `docs/CONTRIBUTING.md`. Resolve the CLA-vs-DCO question explicitly and delete the losing claim (§5.3).

### S3 — Setup instructions live in six places

| Document | Setup content |
|:---|:---|
| `README.md` | "Quick Start" + Docker quick start |
| `PROJECT_README.md` | "Installation" + "Running Locally" + "Docker Compose deployment" |
| `CONTRIBUTING.md` | "Getting Started" |
| `docs/CONTRIBUTING.md` | "One-command setup" (a *different* sequence: adds `pnpm build`) |
| `DOCKER.md` | Docker quick start + Hub compose |
| `apps/yotara-website/install.html` | 719 lines of install instructions on the public site |

Only `docs/CONTRIBUTING.md` includes `pnpm build`; only `README.md` covers the `apps/api/.env.example` copy step fully. There is no canonical first-run document.

**Remediation:** one owner per audience, and cross-link rather than restate:

- `README.md` — 30-second quick start only (clone, install, `pnpm dev`), link out.
- `docs/INSTALL.md` (new, or an expanded "Running Locally" in `PROJECT_README.md`) — the canonical local setup, including the env-file step and `pnpm build` where it matters.
- `DOCKER.md` — the canonical self-hosting path, unchanged in role.
- `apps/yotara-website/install.html` — links to `docs/INSTALL.md` for the authoritative version rather than maintaining a sixth copy.

### S4 — No single source of truth for environment variables

Environment variables are documented across six artefacts — `README.md`, `PROJECT_README.md`, `DOCKER.md`, `apps/api/.env.example`, `docker-compose.yml`, `docker-compose.hub.yml` — and they contradict each other. Confirmed conflicts:

| Variable | Conflict |
|:---|:---|
| `RATE_LIMIT_MAX` | `DOCKER.md:172` says "1000 requests/min"; `.env.example` ships `100`; `apps/api/src/server.ts` defaults to `200` when unset. `DOCKER.md:194` contradicts its own line 172. |
| `APP_BASE_URL` | `DOCKER.md:93` says `http://localhost:8080/api`; compose and `apps/api/Dockerfile` set `http://localhost:8080` (no `/api` — nginx strips the prefix, so the documented value would break callbacks). |
| `DATABASE_URL` | `DOCKER.md:92` says `./apps/api/data/yotara.db`; `.env.example:9` and `PROJECT_README.md:255` say `./data/yotara.db`. |
| `EMAIL_FROM` | `.env.example:51` defaults to `noreply@yotara.app`; `docker-compose.yml:32` sets `noreply@email.yotara.website`. |
| `RESEND_API_KEY` | `.env.example` marks it optional ("if not set, emails are logged to console"); `DOCKER.md` and compose treat it as required in production. |
| `TRUST_PROXY` | `docs/ARCHITECTURE.md:117` describes `trustProxy: 1`; `DOCKER.md:94` documents a CIDR default; `docker/nginx.conf` sets neither. |

Absent from every prose doc but present in `.env.example` or compose: `DEV_MODE`, `ALLOW_DEV_MODE_IN_PRODUCTION`, `FRONTEND_BASE_URL`, `HOST`, `RESEND_API_KEY`, `EMAIL_FROM`, `TRUST_PROXY`.

**Remediation:** create `docs/CONFIGURATION.md` as the single reference table (name, required?, default, purpose, where it applies). Every other doc links to it. Add a CI check that every key in `apps/api/.env.example` appears in the table (see §8).

### S5 — `docs/ARCHITECTURE.md` violates its own documented policy

The "Planning and documentation policy" section states: *"Do not add a new sprint plan, backlog table, or 'recently completed' checklist here."* The document then does all three:

- **Backlog table** (line 233): *"118 items total: 15 Done, 14 In Progress, and 89 Todo"* plus a priority distribution.
- **Issue-backed architecture map** (line ~208): a six-row table of issue numbers per theme.
- **In-progress status claims** (line 174): *"Issue #175 is currently In Progress on the Roadmap Project"*; line ~254: *"#173 and #179 are Todo while #174 is Done and #178 is In Progress."*

This content is a snapshot dated 2026-08-01 and duplicates the GitHub Project board, which the same document correctly names as the source of truth. It also applies to your standing preference that architecture docs not carry status tracking — status belongs on the board.

**Remediation:** delete "Roadmap Project snapshot" and the status sentences in "Known risks" entirely; keep the "Issue-backed architecture map" only if reduced to *theme → architectural implication*, with issue numbers dropped or moved to the board. The eight "Engineering principles" bullets and the "Important architectural decisions" section are the durable value — keep them as-is. Bump the "Last reviewed" date only when the content is actually re-read.

---

## 3. Factual errors in canonical docs

Correct these first — each is a confident, specific, wrong claim in a document readers are told to trust.

### 3.1 Node version is wrong in three files

| Location | Claim | Reality |
|:---|:---|:---|
| `README.md:98` | Node `22.22.1+` | `>=22.22.3` |
| `PROJECT_README.md:155` | Node.js 22.22.1 or newer | `>=22.22.3` |
| `CONTRIBUTING.md:13` | Node.js 22.22.1 or newer | `>=22.22.3` |

Proof: `package.json` → `engines.node: ">=22.22.3"`; `.github/workflows/ci.yml` pins `22.22.3`; both Dockerfiles use `node:22.22.3-alpine`.

**Remediation:** change all three to `22.22.3`. Better: state `>=22.22.3` in `README.md` only and have the others link to it.

### 3.2 `testing.md` says the E2E suite does not exist

`testing.md:236` — *"Not yet implemented. **Playwright** is recommended for cross-service verification."*

Reality: a full Playwright suite is implemented and running in CI — `apps/frontend/playwright.config.ts` with five projects (login, e2e, onboarding, mobile, logout), 21 spec files under `apps/frontend/e2e/`, `e2e*` scripts in `apps/frontend/package.json`, and a live `e2e` job in `.github/workflows/ci.yml`. `docs/ARCHITECTURE.md:265` even states that Playwright tests cover user journeys, so the two docs disagree.

**Remediation:** replace §4 with real Playwright documentation: how to run (`pnpm --filter @yotara/frontend e2e`), the project matrix, fixtures (`e2e/fixtures/auth.ts`), `global-setup.ts`, and the mobile project. The mobile task-modal suite (`e2e/specs/authenticated/task-modal.mobile.spec.ts`) is entirely undocumented anywhere.

### 3.3 `testing.md` understates CI

`testing.md` §5 lists four PR checks (`pnpm lint`, `format:check`, `typecheck`, `test`). The real `ci.yml` also runs `build`, `e2e`, `coverage`, `docker-and-smoke`, `docker-api-native`, and a `pnpm audit` step.

**Remediation:** list the actual job matrix, or replace the section with a link to `ci.yml` and a one-line summary. Prefer the link — job lists rot fastest.

### 3.4 `docs/CONTRIBUTING.md` has two stale claims

- Line 28: lists `team` as a frontend feature directory. Actual `apps/frontend/src/app/features/`: `auth, error, onboarding, personal, shell, tasks`.
- Line 49: tells contributors to add route tests at `apps/api/test/routes/<resource>.test.ts`. Tests are colocated: `apps/api/src/routes/<resource>.test.ts`.

**Remediation:** fixed as part of the S2 merge (these sections move into root `CONTRIBUTING.md` with corrected paths).

### 3.5 `docs/RELEASING.md` describes the wrong release pipeline

| Line | Claim | Reality |
|:---|:---|:---|
| 12 | GitHub Actions "publishes GitHub releases on tag push" | `.github/workflows/release.yml` triggers on `workflow_run` after CI completes (plus `workflow_dispatch`); it *creates* the tag |
| 63 | "Attaches build artifacts" | `softprops/action-gh-release@v2` attaches no artifacts — only `body_path: CHANGELOG.md` |
| 66 | "Auto-merge: The release workflow creates a PR back to `main`" | No PR is created; the workflow pushes directly to `main` |
| — | (absent) | Docker Hub publishing — `docker-build` and `docker-manifest` jobs pushing multi-platform `apauldev2/yotara-api` / `yotara-frontend` with `:latest` manifests — is undocumented |

The documented manual path (`pnpm release`, then `git push origin main --follow-tags`) is also wrong for maintainers: the release is automated.

**Remediation:** rewrite the "What happens" and "Manual release" sections around the actual `workflow_run` pipeline, document the Docker Hub jobs, and document the `chore(release)` / `chore(deploy)` commit-ignore rule that the pipeline depends on. That last rule is load-bearing and currently undocumented — `scripts/release.mjs` filters only those two prefixes.

### 3.6 `docs/ARCHITECTURE.md` is wrong about the proxy directive

Line 121 states the bundled nginx overwrites `X-Forwarded-For` using `$proxy_add_x_forwarded_for`. `docker/nginx.conf:115,133,148` actually uses `$remote_addr`.

The security conclusion still holds — `$remote_addr` also prevents client forgery — but the document justifies its security posture with a directive the project does not use. Since this is a security argument, the mechanism should be stated correctly.

**Remediation:** correct the directive name. Consider noting *why* `$remote_addr` was chosen over `$proxy_add_x_forwarded_for` (the latter appends client-supplied values, which is exactly the forging risk the paragraph warns about).

### 3.7 `docs/ARCHITECTURE.md` says email verification is dormant

Line 24: *"`requireEmailVerification` is `false`, so the flow is inactive until that flag is flipped (tracked as future work in `docs/admin-notifications.md`)."*

Reality: verification is implemented and dynamic — `apps/api/src/lib/auth.ts` gates on `emailVerificationRequired()` (true in production or when `REQUIRE_EMAIL_VERIFICATION=true`), with `apps/api/src/lib/email.ts`, `email-rate-limit.ts`, `email-cleanup.ts`, and the `/config` flag all present. `docs/email-verification-implementation-log.md` records it as complete.

**Remediation:** rewrite the bullet to describe the shipped behaviour and the `DEV_MODE` interaction.

### 3.8 Stale test counts in `docs/ARCHITECTURE.md`

Line 33: *"212 API tests and 636 frontend tests."* Three docs quote three different numbers — `docs/email-verification-implementation-log.md` says 245/653, `todo.md:3` says 258 API / 738 unit. None match the current tree (31 API test files, 53 frontend spec files).

**Remediation:** delete the counts. Exact test counts in prose are guaranteed to rot; if the number matters, surface it from CI or Codecov instead.

### 3.9 `PROJECT_README.md` route map is missing four routes

The "Current Route Map" table omits four routes that exist in `apps/frontend/src/app/app.routes.ts`:

- `/verify-email` (line 32)
- `/forgot-password` (line 38)
- `/reset-password` (line 43)
- `/notifications` (line 114)

**Remediation:** add them, or replace the hand-maintained table with a short pointer to `app.routes.ts` (see §6.2).

---

## 4. Undocumented surfaces

### 4.1 `apps/yotara-website` is documented nowhere

A complete third workspace app exists — a static marketing site (`index.html`, `blog.html`, `features.html`, `install.html`, `privacy/`, Cloudflare `functions/`, `_headers`) that is the source of the `yotara.website` links in `README.md`, and that release tooling touches via `scripts/sync-website-version.mjs` and the `.versionrc.json` `postbump` hook.

It appears in **no** project-structure tree — not in `README.md`, `PROJECT_README.md`, or `CONTRIBUTING.md` — and is absent from `apps/frontend/README.md`-style per-app docs. A contributor reading any structure tree would conclude the monorepo has two apps.

**Remediation:** add `apps/yotara-website` to every structure tree and give it a one-paragraph README covering what it is, how to preview it locally, and the version-sync hook.

### 4.2 Three of five CI workflows are undocumented

`.github/workflows/` contains `ci.yml`, `codeql.yml`, `pr-agent.yml`, `release.yml`, `secret-scan.yml`. No Markdown file mentions `codeql.yml`, `pr-agent.yml`, or `secret-scan.yml`. `DOCKER.md` says images publish "on every release" without naming the jobs.

**Remediation:** one "CI and automation" table — workflow, trigger, purpose — placed in `CONTRIBUTING.md` (contributor-facing) with a link from `docs/ARCHITECTURE.md`. This is the natural place to also document the release `workflow_run` gate.

### 4.3 `apps/frontend/README.md` is stock Angular CLI boilerplate

80 lines of `ng serve` / `ng test` / `ng e2e` scaffolding that contradicts project conventions: it uses `ng` commands where the repo convention is `pnpm --filter @yotara/frontend …`, and it states that Angular CLI ships no E2E framework while the project uses Playwright.

**Remediation:** replace with a short app-level README: what lives in `core/`, `features/`, `shared/`; how to run dev/test/e2e; and a pointer to `testing.md`. Do not restate setup — link to it.

---

## 5. Vague or unverifiable claims

### 5.1 `SECURITY.md` has no real reporting channel

The reporting section says to "Send details to the repository owner via GitHub's contact form." That is not a defined mechanism — there is no such form — and no email address is given. The supported-versions section says "backported only to the most recent major version," but the project is at `0.76.1` and has no major release.

**Remediation:** point at GitHub Security Advisories (a real, private, working channel) as the primary method, or add a dedicated security contact address. Replace the version table with an explicit statement about the current pre-1.0 policy.

### 5.2 `CODE_OF_CONDUCT.md` has no contact method

Uses Contributor Covenant 2.0, which requires a reporting contact. The text says incidents "may be reported by contacting the project maintainers" without saying how.

**Remediation:** add a concrete contact (same channel as §5.1).

### 5.3 CLA and DCO are both claimed

`CONTRIBUTING.md` says the contributor signs the CLA and that "CLAassistant will prompt you automatically on your first pull request." `docs/CONTRIBUTING.md` instead requires `git commit -s` for the DCO. `CLA.md` exists at the root but there is no CLAassistant configuration, workflow, or app reference in the repository — the automation claim cannot be verified from the repo.

**Remediation:** decide which agreement applies, keep it, delete the other, and correct or drop the CLAassistant sentence if the automation is not actually installed. This is a legal-relevant inconsistency, so treat it as P0.

### 5.4 "Merge requires at least one approval" is unverifiable

`CONTRIBUTING.md` states this, but there is no `CODEOWNERS` and no ruleset or branch-protection config in the repository. This may well be true in GitHub settings — it is simply not something a reader or contributor can confirm, and it is not enforced by any visible artefact.

**Remediation:** either add a committed ruleset (or `CODEOWNERS`) so the claim is backed, or soften the wording to describe intent.

---

## 6. Target information architecture

### 6.1 Proposed document set

| Document | Owns | Audience | Status |
|:---|:---|:---|:---|
| `README.md` | Product pitch, screenshots, 30-second quick start, feature tour | Evaluator | Keep |
| `docs/README.md` | **New** — index of all docs with purpose/audience/status | Everyone | New |
| `docs/INSTALL.md` | **New** — canonical local setup and first run | Self-hoster, contributor | New |
| `docs/CONFIGURATION.md` | **New** — single env-var reference table | Operator | New |
| `docs/ARCHITECTURE.md` | Durable decisions, constraints, risks, engineering principles | Architect, contributor | Strip status content |
| `CONTRIBUTING.md` | Setup pointer, workflow, conventions, CI table, contribution agreement | Contributor | Absorb `docs/CONTRIBUTING.md` |
| `testing.md` | Test strategy, runners, Playwright, patterns | Contributor | Fix |
| `DOCKER.md` | Self-hosting and operations | Operator | Fix |
| `docs/RELEASING.md` | Release pipeline, Docker publishing, versioning rules | Maintainer | Fix |
| `docs/DEPLOYMENT-HARDENING.md` | **Renamed** from `security-hardening-plan.md` — the parts that are policy, not plan | Operator | Rename + trim |
| `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CLA.md` | Policy | Everyone | Fix contacts |

### 6.2 Generate what can be generated

Three of the most rot-prone sections are hand-maintained restatements of machine-readable sources:

| Rot-prone section | Machine source | Recommendation |
|:---|:---|:---|
| `PROJECT_README.md` API endpoint list (~40 endpoints) | OpenAPI spec at `/docs/openapi.json`, validated by `pnpm docs:check` | Delete the list; link to Swagger UI and the exported spec |
| `PROJECT_README.md` route map (14 routes) | `apps/frontend/src/app/app.routes.ts` | Delete or reduce to a pointer |
| Task/Project/Label field tables | `apps/api/src/db/schema.ts` and `packages/shared` types | Reduce to a link, or generate a reference from the schema |

`PROJECT_README.md` is 428 lines, of which the endpoint list, route map, field tables, and duplicated command tables are the bulk and the source of most rot. Its unique remaining value — the storage layout, the workspace command reference, and the API examples — is worth keeping.

**Recommendation:** split `PROJECT_README.md` into (a) `docs/INSTALL.md` for setup and (b) a trimmed technical reference that links to generated sources instead of restating them. Do not leave a 428-line document that is 60% duplicated elsewhere.

---

## 7. Per-file disposition

`Archive` means move to `docs/archive/` with a one-line header noting why it is historical, so the reasoning stays recoverable.

| File | Lines | Verdict | Action |
|:---|:---|:---|:---|
| `README.md` | 342 | Keep — trim | Fix Node version (3.1); drop "Recent updates" (duplicates `CHANGELOG.md`); deep-link the blog posts |
| `PROJECT_README.md` | 428 | Split | Fix Node version and route map; extract `docs/INSTALL.md`; delete endpoint/field tables |
| `CONTRIBUTING.md` | 208 | Keep — absorb | Merge unique sections from `docs/CONTRIBUTING.md`; add CI table; resolve CLA/DCO |
| `docs/CONTRIBUTING.md` | 96 | **Merge → delete** | Content moves to root `CONTRIBUTING.md` |
| `docs/ARCHITECTURE.md` | 315 | Keep — strip | Remove board snapshot, status claims, test counts; fix proxy + email-verification claims |
| `docs/RELEASING.md` | 185 | Fix | Rewrite around the real `workflow_run` pipeline |
| `testing.md` | 329 | Fix | Playwright section, CI job matrix |
| `DOCKER.md` | 276 | Fix | Env-var table → link to `docs/CONFIGURATION.md` |
| `apps/frontend/README.md` | 80 | Replace | Angular boilerplate → app-level guide |
| `SECURITY.md` | 33 | Fix | Real reporting channel |
| `CODE_OF_CONDUCT.md` | 49 | Fix | Reporting contact |
| `CLA.md` | 35 | Keep | Resolve relationship with DCO |
| `CHANGELOG.md` | 1,433 | Keep | Generated — do not hand-edit |
| `ROADMAP.md` | 779 | **Archive** | Self-declared out of use; board is the source of truth |
| `docs/project-plan.md` | 152 | **Archive** | Superseded by the board; duplicates `ROADMAP.md` |
| `docs/personal-mode-mvp.md` | 96 | **Archive** | Stale snapshot; contradicts the shipped unified `/tasks` route |
| `docs/admin-notifications.md` | 867 | **Archive** | Marked "Not yet started"; Phases 3–4 shipped differently; Phase 4 grace period contradicts shipped 24h cleanup; Phase 5 Web Push never built |
| `docs/setup-install-experience.md` | 1,607 | **Archive** | Marked "Not yet started"; nothing implemented; conflicts with `admin-notifications.md` on the admin auth model |
| `docs/email-verification-implementation-log.md` | 71 | **Archive** | Shipped; implementation log |
| `docs/plans/db-transactions.md` | 231 | **Archive** | Shipped — `db.transaction(..., { behavior: 'immediate' })` is in `task-service.ts` |
| `docs/plans/notifications-implementation.md` | 534 | **Archive** | Shipped — service, routes, bell, page, and E2E spec all exist |
| `todo.md` | 122 | **Archive** | A completion report named like pending work; conflicts with `ROADMAP.md` counts |
| `apps/api/TODO.md` | 163 | **Archive** | Self-declared historical |
| `apps/frontend/TODO.md` | 260 | **Archive** | Self-declared historical |

**Net effect:** ~4,900 of ~9,040 lines (54%) leave the main tree, and the five documents a reader is most likely to open become correct.

---

## 8. Workstreams

### P0 — Correctness and legal (do first, independently shippable)

1. Fix the three Node-version claims (§3.1).
2. Resolve CLA vs DCO and correct the CLAassistant claim (§5.3).
3. Fix the three `DOCKER.md` env-var errors, especially `APP_BASE_URL` (§3, §S4).
4. Fix the `docs/ARCHITECTURE.md` proxy-directive and email-verification claims (§3.6, §3.7).
5. Fix `testing.md`'s "Playwright not implemented" (§3.2).
6. Give `SECURITY.md` and `CODE_OF_CONDUCT.md` real reporting channels (§5.1, §5.2).

**Acceptance:** every claim in §3 and §5 verified against source; no doc states a version, default, or mechanism that contradicts a config file.

### P1 — Structure

7. Add `docs/README.md` as the index (§S1).
8. Merge `docs/CONTRIBUTING.md` into root `CONTRIBUTING.md`; delete the duplicate (§S2).
9. Create `docs/CONFIGURATION.md`; rewrite the env tables in `DOCKER.md` and `PROJECT_README.md` to link to it (§S4).
10. Create `docs/INSTALL.md`; reduce `README.md` and `PROJECT_README.md` setup sections to pointers (§S3).
11. Add the CI/automation workflow table to `CONTRIBUTING.md` (§4.2).
12. Add `apps/yotara-website` to all structure trees; write its README (§4.1).

**Acceptance:** each setup, env-var, and CI fact has exactly one owning document; no fact is restated in more than one place without a link.

### P2 — Prune and prevent recurrence

13. Archive the twelve historical files in §7 and add `docs/archive/README.md` explaining the policy.
14. Strip `docs/ARCHITECTURE.md` of status content and delete the stale test counts (§S5, §3.8).
15. Fix `docs/RELEASING.md` around the real pipeline (§3.5).
16. Delete the generated-source duplications in `PROJECT_README.md` (§6.2).
17. Replace `apps/frontend/README.md` (§4.3).

### Guardrails

18. **Env-var doc check in CI:** extend `pnpm docs:check` so every key in `apps/api/.env.example` must appear in `docs/CONFIGURATION.md`. This makes §S4 a build failure rather than a future audit finding.
19. **Delete-on-ship:** when a plan in `docs/plans/` ships, archive it and add the outcome to `CHANGELOG.md`. Five of the files in §7 are plan documents that were never retired.
20. **Review dates:** `docs/ARCHITECTURE.md` carries "Last reviewed" — honour it, and only bump the date when content is actually re-read. Prefer deleting status prose over dating it.
21. **Staleness banner standard:** historical files get one consistent banner (as `ROADMAP.md` already does well) plus a link to the current source of truth.

---

## 9. Open questions

1. **CLA or DCO?** Which agreement is intended? If CLA, is CLAassistant actually installed on the repo? This blocks P0 item 2.
2. **Is `ROADMAP.md` deletion acceptable,** or should it stay at the root as a signpost to the board? Recommendation: keep a ~10-line `ROADMAP.md` that links to the board, and archive the 779-line content.
3. **Should `testing.md` move to `docs/TESTING.md`?** It is the only contributor doc at the root besides `CONTRIBUTING.md`. Moving it makes `docs/` the single home for deep docs, at the cost of one round of link churn.
4. **Should `PROJECT_README.md` be renamed?** The name implies a companion to `README.md`, which is exactly the duplication problem. A name like `docs/REFERENCE.md` would signal its narrowed scope.
5. **Should generated API reference replace the hand-written endpoint list** entirely, or is a curated subset worth keeping for discoverability?
6. **Who owns the docs going forward?** A named owner per document in `docs/README.md` is the cheapest defence against the drift this plan describes.

---

## 10. Appendix — verified supporting evidence

| Claim in this plan | Proof |
|:---|:---|
| Node `>=22.22.3` | `package.json` `engines`; `.github/workflows/ci.yml`; both Dockerfiles |
| Playwright implemented | `apps/frontend/playwright.config.ts`; 21 files under `apps/frontend/e2e/`; `e2e` job in `ci.yml` |
| Tests colocated | 31 `*.test.ts` under `apps/api/src/`; `testing.md`-style `apps/api/test/` does not exist |
| No `team` feature dir | `apps/frontend/src/app/features/` → `auth, error, onboarding, personal, shell, tasks` |
| Route map incomplete | `app.routes.ts:32,38,43,114` |
| nginx uses `$remote_addr` | `docker/nginx.conf:115,133,148` |
| `RATE_LIMIT_MAX` default 200 | `apps/api/src/server.ts`; `.env.example:42` ships `100` |
| `APP_BASE_URL` has no `/api` | `docker-compose.yml`, `docker-compose.hub.yml`, `apps/api/Dockerfile` |
| Release triggers on CI completion | `.github/workflows/release.yml` (`workflow_run`) |
| No artifacts attached | `softprops/action-gh-release@v2` with `body_path` only |
| Docker publishing undocumented | `docker-build` / `docker-manifest` jobs; `apauldev2/yotara-*` images |
| `docs/` has no index | no `docs/README.md` |
| `apps/yotara-website` undocumented | absent from all three structure trees; `scripts/sync-website-version.mjs` |
| Board content in `ARCHITECTURE.md` | lines 174, ~208, 233, ~254 |
| Blog posts exist for the "Why these choices?" links | `apps/yotara-website/data/blog.json` — "Why SQLite?", "Why Self-Host?", "Designing for Focus", "Seven Themes", +6 |
