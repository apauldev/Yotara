# Archived Documentation

Superseded plans, implementation logs, and historical snapshots. These files are
**kept for context only** — they are not maintained and must never be treated as
current status.

## Why keep them

Three reasons:

1. **Decision history.** A plan that describes why a design was chosen still has
   value after the work ships.
2. **Searchability.** Someone asking "why does email verification work this way?"
   can find the original reasoning instead of re-litigating it.
3. **Honest limits.** Several plans here describe work that was never built.
   Recording that is more useful than deleting the question.

## The rule

- **Current status** lives on the [Yotara Roadmap](https://github.com/users/apauldev/projects/1)
  board and in GitHub Issues. Never in an archived file.
- **Durable architecture** lives in [docs/ARCHITECTURE.md](../ARCHITECTURE.md).
- **Completed work** is recorded in `CHANGELOG.md`, which is generated from
  commits.
- **Superseded plans are archived here** with a banner naming the date and the
  reason, rather than being left in `docs/` where they read as current.

An archived file describes the world as it was at the time of writing. Where an
archived plan and the code disagree, the code wins.

## Contents

| File | What it was | Outcome |
|:---|:---|:---|
| [roadmap-mvp.md](./roadmap-mvp.md) | The original MVP roadmap with P0–P4 priority tables and sprint plans | Superseded by the GitHub Project board. Its status columns drifted well behind reality. |
| [project-plan.md](./project-plan.md) | An earlier PM action plan, largely duplicating the roadmap | Superseded by the board. |
| [personal-mode-mvp.md](./personal-mode-mvp.md) | A "what shipped" snapshot of the personal-mode MVP | Describes dedicated `/inbox`, `/today`, and `/upcoming` routes that were later consolidated into a single `/tasks` view. |
| [admin-notifications.md](./admin-notifications.md) | A large plan for admin APIs, email verification, and Web Push | Partially superseded. Email verification shipped differently (24-hour cleanup rather than a 7-day grace period, Resend only rather than multiple providers), and the Web Push phase was never built. |
| [setup-install-experience.md](./setup-install-experience.md) | A plan for a first-run setup wizard, avatar picker, recovery hash, and admin panel | Never started. Its proposed admin model also conflicts with the one in `admin-notifications.md`. |
| [email-verification-implementation-log.md](./email-verification-implementation-log.md) | Implementation log for the email-first signup flow | Work is complete; the log's commit and test-count tables are frozen at the time of writing. |
| [db-transactions.md](./db-transactions.md) | Plan to wrap multi-table writes in SQLite transactions | Shipped. The `tx?: Database` pattern it proposes is used across the services. |
| [notifications-implementation.md](./notifications-implementation.md) | Plan for in-app notifications, the bell, and the notifications page | Shipped, including the E2E coverage. |
| [mobile-task-workflow.md](./mobile-task-workflow.md) | Completion report for the mobile task-modal workflow (Tasks 1–4) | Shipped. The file was originally `todo.md` at the repo root, which made completed work read as pending. |
| [api-todo.md](./api-todo.md) | The API package TODO list | Retired when planning moved to GitHub Issues. Surviving items were migrated with the `harvested-from-docs` label. |
| [frontend-todo.md](./frontend-todo.md) | The frontend package TODO list | Same as above. |
| [security-hardening-plan.md](./security-hardening-plan.md) | The security hardening plan covering CSP, security headers, password policy, and secret validation | Shipped. The durable policy now lives in [DOCKER.md](../../DOCKER.md) and [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Its §3 environment-configuration analysis is superseded: `angular.json` does use `fileReplacements`, and email verification is now environment-driven. |
| [documentation-overhaul.md](./documentation-overhaul.md) | The audit and remediation plan for this documentation set | Implemented. Records the documentation as it was before the overhaul, including the verified errors that were corrected. |
| [precheck-beta-release.md](./precheck-beta-release.md) | A pre-flight checklist for the first beta Docker deploy | The beta shipped. Its §2.4 E2E-diagnostics finding is resolved: CI now uploads `playwright-report/`, `test-results/`, and both service logs with `if: always()`, and terminates the background processes in an `always()` step. |

## Adding to this archive

When a plan in `docs/plans/` ships or is abandoned:

1. Move the file here with `git mv` so history is preserved.
2. Add the archive banner at the top naming the date and the outcome.
3. Add a row to the table above.
4. Fix any relative links the move broke.
5. If the work shipped, make sure it is represented in `CHANGELOG.md` through
   its commits.
