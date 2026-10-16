# Plan: Refresh the Yotara Marketing Site

> **Status:** Proposed — not started
> **Owner:** @apauldev
> **Date:** 2026-10-16
>
> Refresh the copy and factual details of the static marketing site
> (`apps/yotara-website/`) to match the product as of v0.80.2, and repair the
> release automation that was supposed to keep the site's version metadata
> current — but has never actually done so. Preserve the existing visual system
> and page structure: no redesign, and no roadmap item presented as shipped.

---

## 1. Context & Motivation

### 1.1 The site stopped tracking the product

The last marketing-focused change was PR [#316](https://github.com/apauldev/Yotara/pull/316)
on 2026-07-29. Everything since has been product work, so the site understates
what Yotara does. Three shipped capabilities appear nowhere on the site:

| Shipped | PR | Merged | What users can actually do |
|:---|:---|:---|:---|
| Mobile task workflow with shared modal shell | [#372](https://github.com/apauldev/Yotara/pull/372) | 2026-09-08 | Create and edit tasks comfortably on a phone (responsive web, not a native app) |
| Natural-language due-date preview | [#384](https://github.com/apauldev/Yotara/pull/384) | 2026-09-28 | Type "pay rent next friday" and see the parsed date before saving |
| Due-time support — manual entry, NLP parsing, in-app notifications | [#396](https://github.com/apauldev/Yotara/pull/396) | 2026-10-02 | Set a time of day ("tomorrow at 3pm") and get an in-app reminder when it comes due |

### 1.2 The homepage version metadata is wrong — and the sync has never once worked

The homepage footer badge reads `v0.71.1 · released Aug 1, 2026`, the
`softwareVersion` JSON-LD reads `0.70.2`, and the monorepo is at v0.80.2
(2026-10-15). Three different versions, two of them stale by ~2.5 months of
releases.

This is not a forgotten manual edit. `scripts/sync-website-version.mjs` is
wired into `.versionrc.json` as a `postbump` hook and is documented in
`apps/yotara-website/README.md` as running "automatically during releases".
**It has never successfully updated the site.** Root cause:

1. `postbump` runs `node scripts/sync-website-version.mjs && git add apps/yotara-website/index.html`.
   The script rewrites the badge and JSON-LD; the `git add` stages the file.
2. `commit-and-tag-version` (v12.7.3, the release bump tool) then commits **only
   the files it bumped** unless `--commit-all` is set: its commit step issues
   `git commit package.json CHANGELOG.md -m …`
   (`node_modules/commit-and-tag-version/lib/lifecycles/commit.js`).
3. The path-scoped commit silently leaves `index.html` staged but uncommitted.
   In CI (`.github/workflows/release.yml` → `pnpm release`) the ephemeral
   runner is discarded, so the change evaporates.

Evidence:

- Every release commit from v0.71.0 through v0.80.2 touches only `package.json`
  and `CHANGELOG.md` — `git show --stat` each; `index.html` never appears.
- The badge was last changed by hand in `e657163` ("docs: update Angular 22 and
  v0.71.1 references…"), which updated only the footer from `v0.70.2` to
  `v0.71.1` and left the JSON-LD at `0.70.2` — exactly the hand-edit the
  website README forbids because the next release "will overwrite it". That
  promise was never true.
- Reproduced end-to-end in a scratch repository with the same hook shape: the
  release commit excludes the staged file. Adding `"commitAll": true` to
  `.versionrc.json` makes the commit include it and leaves a clean tree.

**Fix:** set `"commitAll": true` in `.versionrc.json` (one line; verified in
the scratch repro). The hook's `git add` stays — it is what stages the file for
`commitAll` to pick up. Fallback if reviewers dislike commit-all semantics:
declare `index.html` as a custom `bumpFile` with an updater module, which puts
it in the tool's commit set without global commit-all behavior — more code, so
plan A is the one-line fix.

### 1.3 One FAQ answer is now factually wrong

The homepage FAQ says backups work by "copying the file somewhere safe … No
dump or restore commands needed". Since the WAL hardening in PR
[#404](https://github.com/apauldev/Yotara/pull/404), the database has `-wal` /
`-shm` sidecar files: copying only the `.db` while the app runs can silently
omit recent commits. `docs/CONFIGURATION.md` and `docs/ARCHITECTURE.md` now
document the sidecars and `sqlite3 .backup`. The site's advice needs to match.

### 1.4 Boundaries to preserve

- **Responsive web, not native.** Keep the FAQ's "no native iOS or Android app;
  PWA is on the roadmap" boundary. The #372 workflow makes the web app *better
  on phones*; it does not make an app that can be downloaded.
- **Notifications are in-app only.** No push, email, or SMS delivery claims.
- **Managed cloud stays roadmap-labeled.** Do not describe `pnpm run deploy`
  (maintainer beta automation) as an end-user cloud feature.
- **Team mode is planned.** Do not add collaboration claims.

---

## 2. Proposed Changes

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Release automation (root)                                                │
│  ├─ .versionrc.json: "commitAll": true (release commit includes stamp)   │
│  ├─ scripts/sync-website-version.mjs: fail loudly on pattern miss        │
│  └─ scripts/sync-website-version.test.mjs: drift-guard test (new)        │
├──────────────────────────────────────────────────────────────────────────┤
│ Site content (apps/yotara-website/)                                      │
│  ├─ index.html:   feature copy, FAQ (reminders + corrected backup),      │
│  │                JSON-LD FAQ mirror, current badge/softwareVersion      │
│  ├─ features.html: dates & times, NLP preview, in-app reminders, mobile  │
│  └─ install.html:  install/backup/limitations claims vs current behavior │
├──────────────────────────────────────────────────────────────────────────┤
│ Docs                                                                     │
│  ├─ apps/yotara-website/README.md: note the commitAll dependency         │
│  └─ docs/RELEASING.md: release commits include the website version stamp │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Tasks

### Task 1 — Repair the release version sync

**Files to modify:**
- `.versionrc.json`
- `scripts/sync-website-version.mjs`
- `apps/yotara-website/index.html` (backfill only — via the script, never by hand)

**Implementation details:**

1. Add `"commitAll": true` alongside the existing `scripts.postbump` entry.
   Keep the hook's `git add` — it stages the stamped file for the commit.
2. Harden the sync script: after both `.replace()` calls, verify each pattern
   actually matched (compare against the original). On a miss, print which
   pattern failed and which file, then exit non-zero so the release fails
   loudly. Today a format change makes the script a silent no-op — which is
   precisely how ~2.5 months of drift stayed invisible.
3. Backfill: run `node scripts/sync-website-version.mjs && git add apps/yotara-website/index.html`
   once in this PR. It stamps the current `package.json` version and the run
   date. Do not hand-write values, and do not tune the date — the next release
   restamps both fields automatically now.

**Verification:**
- Scratch-repo repro (the procedure used in the investigation): minimal repo,
  same `.versionrc.json`, run `commit-and-tag-version --release-as patch`, and
  confirm the staged file lands in the release commit with `commitAll: true`
  and does not without it.
- After merge, the next CI release commit (`chore(release): vX.Y.Z`) must
  include `apps/yotara-website/index.html`. Check with
  `git show --stat <release-sha>`.

**Known wart (accept, document if asked):** `commit-and-tag-version --dry-run`
still executes `postbump`, so a local dry run rewrites the date and stages the
file. Unstage/checkout `index.html` after dry runs.

---

### Task 2 — Drift-guard test for the version stamp

**Files to create:**
- `scripts/sync-website-version.test.mjs`

Runs under the existing `pnpm test:scripts` glob (`node --test "scripts/*.test.mjs"`),
which CI already executes via `pnpm test`.

**Implementation details:**

1. Refactor `scripts/sync-website-version.mjs` into a pure exported function
   (e.g. `applyVersionStamp(html, version, date)` returning the updated HTML plus
   which patterns matched) with the side-effecting CLI behind an
   `import.meta.url` entry guard, so the test exercises the real regexes
   instead of a copy.
2. Assert, against the checked-in `apps/yotara-website/index.html` and
   `package.json`:
   - the footer badge pattern matches and its captured version **equals** the
     `package.json` version;
   - the `"softwareVersion"` JSON-LD value equals the `package.json` version.
3. This is the same class of guard as `pnpm docs:check:env`: cheap, fast, and
   it fails CI the moment the site and the manifest disagree.

**Verification:**
```bash
pnpm test:scripts
```

---

### Task 3 — Homepage copy and FAQ (`apps/yotara-website/index.html`)

**Implementation details:**

1. Feature copy: describe natural-language date/time entry ("tomorrow at 3pm"
   style capture with a live parsed preview) and in-app due-time reminders
   alongside the existing capture/planning cards. Reuse the existing card and
   section patterns; keep the card count and two-column balance intact. Voice
   stays short and calm — extend copy, don't add ad-speak.
2. FAQ changes — visible `<details>` items and the `FAQPage` JSON-LD must be
   updated **in the same edit**:
   - Add "How do reminders work?" — in-app notification when a task with a due
     time comes due; no push/email, nothing leaves your server.
   - Revise "Is there a mobile app?" to acknowledge the improved phone workflow
     while keeping "no native app; PWA is on the roadmap".
   - Correct the backup answer per §1.3: stop the app before copying the `.db`,
     or use `sqlite3 .backup`; mention the `-wal`/`-shm` sidecars; link
     `DOCKER.md`.
3. Meta: update the page `<title>`/description and og/twitter descriptions only
   if the positioning text they summarize actually changes. Leave canonical
   URLs untouched. Never hand-edit the badge or `softwareVersion` — Task 1's
   script owns them.

**Verification:** preview at desktop and ~375px widths; every new claim traced
to code (see Verification §4).

---

### Task 4 — Features page (`apps/yotara-website/features.html`)

**Implementation details:**

1. "Set it and forget it" section: extend the recurring-task story with due
   dates and times — natural-language entry with live preview (#384), explicit
   time-of-day entry (#396), and in-app reminders when a due time arrives.
2. "Three views, one purpose": mention where due times surface (Today /
   Upcoming) — verify the actual behavior in the app before writing it.
3. Mobile: where the page describes the web app, note it is built to be
   comfortable on phones (#372). Do not imply a native app.
4. Reuse the existing section/card patterns — no new component styles.

**Verification:** claims traced to the implementation; page previewed at both
widths; nav and CTA destinations unchanged and working.

---

### Task 5 — Install page and deployment claims (`apps/yotara-website/install.html`)

**Implementation details:**

1. Sweep commands, env vars, ports, and system requirements against
   `DOCKER.md`, `docs/INSTALL.md`, and `docs/CONFIGURATION.md`; fix anything
   stale.
2. Backup/limitations: align any backup guidance with §1.3 (WAL-safe backup),
   keeping it FAQ-length rather than a tutorial.
3. Keep the "Coming soon" section honest: managed cloud stays roadmap-labeled;
   do not surface `pnpm run deploy` (maintainer beta automation) as a user
   feature.

**Verification:** quick start commands copy-paste-valid against the current
compose files; no claim that contradicts `DOCKER.md`.

---

### Task 6 — Documentation touch-ups

**Files to modify:**
- `apps/yotara-website/README.md`
- `docs/RELEASING.md`

**Implementation details:**

1. Website README: the "will be overwritten at the next release" promise only
   holds because of Task 1 — add one sentence noting the `postbump` hook
   depends on `commitAll` in `.versionrc.json`, so a future maintainer who
   removes the flag knows why it was there.
2. RELEASING.md: state that release commits now include the website version
   stamp (badge + JSON-LD) synced from `package.json` by
   `scripts/sync-website-version.mjs`.

---

## 4. Verification (whole change)

Commands:

```bash
# Local preview (per apps/yotara-website/README.md)
cd apps/yotara-website && python3 -m http.server 8080

# Repo checks that CI runs
pnpm format:check
pnpm test:scripts
pnpm lint
```

Manual checklist:

- [ ] Home, Features, and Install reviewed at desktop and mobile widths;
      nav, FAQ accordions, and every CTA destination work.
- [ ] Every new product claim verified against implemented behavior (PRs #372,
      #384, #396) — no push/email delivery, no native app, no cloud, no teams.
- [ ] Visible FAQ text and `FAQPage` JSON-LD answers are equivalent; all
      JSON-LD blocks still parse as valid JSON.
- [ ] Footer badge and `softwareVersion` match `package.json` (after Task 1's
      backfill) and the drift-guard test passes.
- [ ] `sitemap.xml`/canonical URLs untouched (no pages added or removed).

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|:---|:---|
| `commitAll: true` sweeps unrelated staged files into a release commit | CI always releases from a clean checkout; the only staged file is the hook's stamp. Local rule: run `pnpm release*` with a clean index. |
| The hardened sync script fails a release if the badge format changes | Intentional and loud — a silent no-op caused this drift once. The error names the file and pattern; the fix is one line. |
| Site drifts again on future feature releases | The version badge now updates itself; copy drift remains a human-review concern. Optionally add a "site copy check" line to the release checklist in `RELEASING.md` (follow-up, not required here). |
| Copy overclaims (push notifications, native app, cloud, teams) | Boundaries in §1.4 reviewed explicitly at PR time; claim-to-evidence mapping during verification. |
| FAQ visible text and JSON-LD diverge | Both updated in the same edit; verification greps for the new answers in both places. |

## 6. Out of scope

- Visual redesign, new pages, or blog posts.
- New screenshots (worth a follow-up once due-time UI is stable; the README
  screenshots still show the current visual system).
- Managed-cloud or native-app messaging changes — those stay roadmap items.
