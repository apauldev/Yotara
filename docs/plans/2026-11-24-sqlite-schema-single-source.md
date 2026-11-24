# Plan: One runtime schema authority for SQLite

**Date:** 2026-11-24  
**Status:** Proposed  
**Priority:** Low runtime risk; removes dead artifacts and closes a CI gap  
**Related:**
- `docs/code-quality-review-2026-11-23.md` — finding BE-1 (the trigger for this plan)
- `apps/api/src/db/client.ts` — bootstrap DDL and `ensureSqliteSchema` (the real runtime authority)
- `apps/api/src/db/schema.ts` — Drizzle table definitions used for queries and types
- `apps/api/drizzle/` — generated snapshot chain that is never applied
- `apps/api/drizzle.config.ts`, `apps/api/package.json` — drizzle-kit config and scripts
- `docs/ARCHITECTURE.md` — documents the current "snapshot chain is not applied at boot" design
- `docs/INSTALL.md`, `README.md`, `PROJECT_README.md` — current references to migration scripts and the snapshot directory
- `scripts/deploy.mjs`, `scripts/deploy-logic.mjs` — beta deploy with DB backup and volume rollback

---

## 1. Why this plan exists

Finding BE-1 of the 2026-11-23 code quality review calls this "three sources of truth for the
database schema" and suggests either running Drizzle migrations at boot or keeping one idempotent
DDL source. The active application has two schema representations: runtime DDL and upgrade logic in
`client.ts`, and Drizzle table metadata in `schema.ts`. The snapshot files are historical artifacts,
not a third runtime authority. This plan keeps both active representations and makes their table
and column names agree through a CI check; it does not make schema changes single-edit.

- The Drizzle SQL files are **not** a competing runtime source. Nothing applies them, no
  `db:migrate` script exists, and the repo already documents this in `docs/ARCHITECTURE.md:140`,
  `apps/api/drizzle/0006_*.sql`, and `docs/plans/2026-10-20-label-system-ux-redesign.md:39`.
- Running the snapshot chain at boot is **not** a drop-in fix. `0006` and `0007` were hand-trimmed
  to contain only one `ALTER` each because replaying the full generated chain aborts on duplicate
  columns. They are deliberately non-replayable.
- The real gap is that table or column-name drift between the bootstrap DDL in `client.ts` and the
  Drizzle definitions in `schema.ts` is invisible to CI. That is the risk this plan fixes.

The product is in public beta with a persistent database on one EC2 instance. Downloads are high
but there is no evidence of an external production user base. That lowers the cost of a schema
mistake, but it does not remove the need for in-place upgrades: every deploy backs up the DB volume,
and rollback can restore an older snapshot that must then roll forward on the next start.

## 2. Verified current state

| Artifact | Role today | Lines / count |
|---|---|---|
| `client.ts` bootstrap SQL + `ensureSqliteSchema` | Sole runtime schema authority, including data migrations | 889 lines total; ~250 DDL + ~460 upgrade guards |
| `schema.ts` | Drizzle ORM definitions; required for queries and typing | 272 lines, 12 tables |
| `apps/api/drizzle/*.sql` + `meta/` | Historical snapshots; never read at runtime | 9 SQL + 6 snapshots + journal + `.gitkeep` |
| Migration and schema tests | Exercise the upgrade guards | 10 focused test files |

Checks performed on 2026-11-24 against a fresh in-memory database:

- All 12 Drizzle tables and their declared column-name sets match the fresh bootstrap — **zero
  table or column-name drift today**.
- Three tables are intentionally raw SQL only and must stay outside the Drizzle table-set check:
  `blocked_ips`, `email_sends`, `login_attempts`. SQLite's own `sqlite_sequence` is also excluded.

## 3. Options considered

### A. Run Drizzle migrations at boot — reject

Would require regenerating a coherent baseline, adding a migration runner, replacing procedural
data migrations (label dedupe, Inbox retirement, timestamp normalization) with SQL, and reworking
the rollback flow. High risk, no benefit at beta scale, and it discards working upgrade code.

### B. Reset the beta database and adopt a migration framework — reject for now

This would make option A viable and could eventually allow the current upgrade guards and their
tests to be retired in a separate change. It also wipes beta data and breaks the "restore an old DB
snapshot, then roll forward" story that `scripts/deploy.mjs` is built around. Reconsider only if the
beta data is intentionally reset or a second storage backend (team mode / Postgres) is committed to.

### C. Delete the dead snapshots, keep the real mechanism, add a drift test — **recommended**

Removes the confusing third artifact without touching runtime behavior, and closes the
table/column-name drift gap. Small PR, near-zero risk, reversible.

## 4. Goal and success criteria

**Goal:** document `client.ts` as the sole runtime schema authority, remove unused snapshot
artifacts, and check exact table and column-name parity between the bootstrap and the Drizzle
definitions. `schema.ts` intentionally remains the ORM/type definition, so adding or removing a
column still requires updating both representations.

Success criteria:

- No file under `apps/api/drizzle/` remains; no package script exposes migration generation or push.
- Current documentation no longer advertises those scripts or the removed snapshot directory;
  historical plans may retain references as records of past decisions.
- A fresh in-memory DB created by `createDbClient()` has exactly the Drizzle table and
  column-name sets, plus the three raw-only tables explicitly allowlisted. SQLite internal tables
  are excluded.
- The drift test fails for either a Drizzle column missing from the bootstrap or an extra bootstrap
  column missing from Drizzle.
- The check covers table and column names only. It does not claim parity for types, defaults,
  nullability, indexes, or foreign-key actions.
- All existing database, API, typecheck, lint, and build checks pass unchanged.
- No change to `client.ts` upgrade logic, deploy scripts, DB volume, or backup behavior.

## 5. Safety rules and non-goals

- This is a cleanup plus test, **not** a schema change. Do not edit `ensureSqliteSchema`, bootstrap
  DDL, or any data migration in this PR.
- Do not modify the deploy flow, backup scripts, compose files, or the beta database.
- Do not rewrite or delete the existing migration tests; they still protect the upgrade path.
- Keep `drizzle-orm` and `drizzle-kit` (the latter powers `db:studio`, documented in
  `docs/INSTALL.md`).
- One PR, one merge, one release unit. Leave historical plans under `docs/` as written; record the
  decision in `ARCHITECTURE.md` instead of rewriting old documents.

## 6. Course of action

1. **Branch.** Create `chore/sqlite-schema-authority-parity` from the latest `origin/main`, not from
   the `docs/code-quality-review` branch. Keep the review branch separate.

2. **Remove the dead artifacts.** Delete `apps/api/drizzle/` in full: nine `*.sql` files,
   `meta/` (six snapshots and `_journal.json`), and `.gitkeep`. Verify with a repo-wide grep that
   no runtime code or package script imports or executes them. Remove the stage-to-stage
   `COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle` line from `apps/api/Dockerfile`
   as well: a COPY from a missing source fails the image build and would block beta deploys.
   References in historical plans can remain.

3. **Trim the scripts.** In `apps/api/package.json`, remove `db:generate` and `db:push`. Keep
   `db:studio`, and keep `drizzle-kit` as a devDependency. In `apps/api/drizzle.config.ts`,
   remove the now-stale `out: './drizzle'` field (it is only used by `db:generate`, which is
   being removed) or annotate it as dead; keep the `schema` field, since `db:studio` uses it
   for local inspection. Add a short comment noting that schema changes are applied through
   `client.ts`. `drizzle-kit studio` does not recreate the output directory on its own.

4. **Add the drift test.** New file `apps/api/src/db/schema-drift.test.ts`:
   - Create a fresh DB with `createDbClient(':memory:')`.
   - Enumerate the tables dynamically from the `schema.ts` module namespace (filter exports
     to SQLite table objects) and use `getTableConfig()` from `drizzle-orm/sqlite-core` on
     each one to enumerate table and column names. Do not keep a hardcoded list — a new table
     added to `schema.ts` must be covered automatically.
   - Compare the set of bootstrap tables with the Drizzle tables plus the raw-only allowlist
     (`blocked_ips`, `email_sends`, `login_attempts`), so a forgotten table is caught. Read the
     table list from `sqlite_master` with `type = 'table' AND name NOT LIKE 'sqlite_%'` to
     exclude SQLite internals such as `sqlite_sequence`.
   - For each Drizzle table, compare the exact set of column names with
     `PRAGMA table_info(<table>)`. Report both missing and unexpected columns; checking only that
     Drizzle columns are present would miss bootstrap-only columns.
   - Keep assertion messages explicit about both fixes: add a missing column to the bootstrap in
     `client.ts`, or remove/add the unexpected column in the appropriate schema representation.
   - Keep the test's contract limited to table and column names; do not describe it as full DDL
     parity.

5. **Prove the test works.** Temporarily add an unused column to one table in `schema.ts`, confirm
   the test fails for a missing bootstrap column; then temporarily add a bootstrap-only column and
   confirm it fails for an extra column. Revert both experiments. Do not commit them.

6. **Update current documentation.** In `docs/ARCHITECTURE.md`, replace the "snapshot chain is not
   applied at boot" note with the decision: the snapshot chain was removed, `ensureSqliteSchema` is
   the sole runtime authority, `schema.ts` remains the ORM/type definition, and the test checks
   table and column-name parity. Mention that a real migration framework is deferred until a second
   storage backend is adopted. In `docs/INSTALL.md`, remove the `db:generate` and `db:push` command
   entries. In `README.md`, remove the `drizzle/ SQLite migrations` line from the project tree
   and change the `db/` entry from `Schema, migrations, client` to `Schema, client, upgrade guards`.
   In `PROJECT_README.md`, remove the `apps/api/drizzle` bullet and the `db:generate`/`db:push`
   commands, and rephrase the "authoritative" claim on line 88 to be two-sided: `schema.ts` is
   authoritative for the Drizzle ORM view (field names, types, nullability), while the bootstrap
   in `client.ts` is the runtime authority, and a test keeps their names in sync. Leave historical
   plans under `docs/plans/` as written.

7. **Check the review finding.** Add a short resolution note under BE-1 in
   `docs/code-quality-review-2026-11-23.md` on its own branch, or leave it for a follow-up that
   closes the checklist item. Describe the result accurately: the unused snapshots are removed and
   table/column-name drift is checked; the bootstrap and Drizzle ORM definitions remain two
   maintained representations. Do not mix it into this PR if the review branch is still unmerged.

## 7. Verification

Run locally before opening the PR:

- `pnpm --filter @yotara/api test` — API suite, including the new drift test and all existing
  migration tests
- `pnpm --filter @yotara/api lint` and `pnpm --filter @yotara/api typecheck`
- `pnpm build` — catches any build-time reference to the removed files
- `pnpm test` — full workspace suite
- Search runtime source, package scripts, `.github/workflows`, and Dockerfiles for references to
  `apps/api/drizzle/`, `db:generate`, and `db:push`; none should import, execute, or advertise them.
  Historical plans may still mention the removed artifacts.
- Confirm `README.md`, `PROJECT_README.md`, `docs/INSTALL.md`, and `docs/ARCHITECTURE.md`
  describe the resulting setup.
- `pnpm format:check` on the touched files

CI runs the same suite on the PR. Confirm `apps/api/Dockerfile` has no COPY from the removed
directory and that all remaining COPY sources exist; build the API image (or let the Docker smoke
job do it) before deploying. No smoke-test script changes are needed because the runtime DB
bootstrap is untouched.

## 8. Rollout and rollback

Merge to `main` and deploy through the existing `pnpm deploy` flow. There is no schema change, so
the usual DB backup and volume-based rollback remain valid, and no data migration is required. If
the PR must be reverted, reverting the commit restores the snapshot files; no DB state needs to be
restored.

## 9. Out of scope / follow-ups

- BE-2 (read endpoints performing writes), BE-4 (OpenAPI/DTO duplication), and the rest of the
  quality review are separate pieces of work.
- A real migration framework (Drizzle migrations or otherwise) should be revisited when team mode
  or a second database backend is committed to, not before.
- If the beta database is ever intentionally reset, revisit option B: the upgrade guards and their
  tests could then be removed in a separate, clearly labeled PR.
- Type, default, nullability, index, and foreign-key parity remains unchecked by design. If fuller
  parity is ever needed, extend the test or generate a schema diff in CI rather than reintroducing
  the snapshot chain.
- Once this PR merges, update BE-1 in the review document to reflect the scoped resolution and
  record the commit SHA there.
