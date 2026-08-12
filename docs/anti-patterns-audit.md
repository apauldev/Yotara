# Anti-pattern audit and remediation recommendations

This document records the engineering and security anti-patterns identified during a repository review. It focuses on issues that can affect correctness, deployment safety, CI trustworthiness, security, or maintainability. Line references identify the current implementation and may change as the code evolves.

The recommendations below are ordered by priority. The first section contains issues that should be addressed before relying on the current checks or deploying the affected behavior. The remaining sections contain important reliability, security, and scaling improvements.

## Executive summary

The highest-value fixes are:

1. Make security, coverage, and required reporting failures visible to CI.
2. Prevent task self-parenting during updates.
3. Introduce explicit, versioned database migrations.
4. Make proxy trust match the actual network topology.
5. Prevent password-reset and verification links from being logged or rendered without escaping.
6. Add cleanup and diagnostics to CI service-based tests.

The repository already has several good defensive measures: frozen-lockfile installs, production secret checks, owner-scoped API queries, parameterized SQL, security headers, foreign-key enforcement, container capability dropping, and broad automated test coverage. The recommendations here should strengthen those controls rather than replace them.

## Priority 1: Fix before treating CI or production controls as reliable

### 1. CI allows important failures to pass

**Evidence**

- `.github/workflows/ci.yml:46-48` sets `continue-on-error: true` for the dependency audit.
- `.github/workflows/ci.yml:68-70` sets `continue-on-error: true` for the entire coverage job.
- `.github/workflows/ci.yml:86-90` sets `fail_ci_if_error: false` for Codecov.

**Issue**

A high-severity dependency vulnerability, a broken coverage run, or a failed coverage upload can leave the workflow green. This makes CI an unreliable merge gate and can hide security or test-infrastructure regressions.

**Recommendation**

- Make `pnpm audit --audit-level=high` blocking.
- Remove `continue-on-error` from the coverage job.
- Set `fail_ci_if_error: true` if Codecov is a required check.
- If coverage reporting is intentionally advisory, move it to a separately named non-gating workflow instead of making the required CI job silently ignore failures.
- Define an explicit process for documenting and expiring accepted vulnerability exceptions rather than ignoring the whole audit result.

**Suggested validation**

Add CI checks that deliberately fail when the audit, coverage command, or coverage upload returns a failure. Confirm the branch protection rules require the intended checks.

### 2. Task updates can create a task that is its own parent

**Evidence**

- Task creation rejects a self-parent relationship (`apps/api/src/services/task-service.ts:342-345`).
- Task updates do not reject `nextParentId === taskId` (`apps/api/src/services/task-service.ts:482-493`).

**Issue**

An update can set a task's `parent_id` to its own ID. The resulting invalid tree can break subtask counts, traversal, deletion, recurrence behavior, or frontend rendering.

**Recommendation**

- Reject `nextParentId === taskId` before looking up the proposed parent.
- Keep the validation in the service layer so every caller receives the same invariant, not only one HTTP route.
- Add a regression test for updating a task with `{ parentId: taskId }` and assert a `400` response.
- Consider adding a database-level constraint where practical, but retain service validation for a clear API error.

### 3. Schema evolution is ad hoc despite an existing migration tool

**Evidence**

- The repository already has versioned Drizzle migrations in `apps/api/drizzle/` (files `0000` through `0005`).
- `apps/api/src/db/client.ts:293-448` still performs ad-hoc startup `ALTER TABLE` statements and backfills outside the migration workflow.

**Issue**

There are two competing schema-evolution mechanisms. The ad-hoc startup code can diverge from the Drizzle migrations or run them out of order, and it still drops/recreates the `login_attempts` table during startup. This makes upgrade behavior harder to reason about and can produce subtle drift between fresh and existing databases. The startup migration logic is also a dangerous pattern to extend, even though the current table is described as transient.

**Recommendation**

- Consolidate all schema changes into the existing Drizzle migration workflow.
- Run migrations as an explicit deployment step before starting application instances.
- Track the applied migration version and make each migration idempotent or safely fail with a clear message.
- Preserve data during shape changes; for `login_attempts`, explicitly decide whether old counters should be migrated or intentionally discarded and record that decision in the migration.
- Add upgrade tests that start from representative prior database snapshots and verify both schema and data.
- Keep startup checks limited to validating that the expected schema is present, not changing it silently.

### 4. Proxy trust is unsafe when the API is directly exposed

**Evidence**

- `apps/api/src/server.ts:53-70` configures Fastify with `trustProxy: 1` and uses `request.ip` for rate limiting.
- `apps/api/Dockerfile:54-61` binds the API to `0.0.0.0`.

**Issue**

`trustProxy: 1` assumes exactly one trusted reverse proxy. If port 3000 is reachable directly or through a different network topology, forwarded headers may be spoofed and IP-based rate limiting or login lockout may be bypassed or misapplied.

This is deployment-dependent: the current nginx topology may make the setting correct, but the application should not silently depend on an undocumented network assumption.

**Recommendation**

- Keep the API port private and expose only the reverse proxy in production.
- Replace the blanket hop count with a trusted proxy IP range or topology-specific trust function where supported.
- Document the required proxy topology and the behavior of `X-Forwarded-For`.
- Add tests covering direct requests and spoofed `X-Forwarded-For` headers.
- Ensure the rate-limit key uses the real client address only after the proxy trust decision has been validated.

## Priority 2: Security and reliability improvements

### 5. Email fallback logs sensitive reset links

**Evidence**

- `apps/api/src/lib/email.ts:8-10` announces that emails will be logged when `RESEND_API_KEY` is absent.
- `apps/api/src/lib/email.ts:25-30` logs the full email body, including authentication URLs.

**Issue**

A production deployment with missing email configuration can appear to work while password-reset and verification links are written to container logs. Anyone with log access may be able to use an unexpired reset link.

**Recommendation**

- Permit console email output only when `NODE_ENV` is explicitly `development` or `test`.
- Fail startup in production when email-dependent account flows are enabled without a configured provider.
- Never log full reset or verification URLs in production; redact tokens and query parameters.
- Add an operational readiness check that reports whether email delivery is configured.
- Add a test proving production configuration cannot silently fall back to logging.

### 6. HTML email templates interpolate unescaped values

**Evidence**

- `apps/api/src/lib/email.ts:63-110` inserts `user.name` and `url` directly into HTML strings.

**Issue**

A crafted display name can inject HTML into an email. The URL is normally generated by the authentication library, but inserting it directly into an `href` attribute relies on that upstream value always being safe in an HTML attribute context.

**Recommendation**

- HTML-escape user-controlled names before inserting them into HTML.
- Attribute-escape URLs before placing them in `href` values.
- Prefer a templating mechanism with contextual escaping if more templates are added.
- Add tests using names containing `<`, `>`, `&`, quotes, and apostrophes.
- Keep the plain-text template as the fallback representation.

### 7. Email verification is disabled while verification support exists

**Evidence**

- `apps/api/src/lib/auth.ts:46-63` wires a verification email callback but sets `requireEmailVerification: false`.

**Issue**

New accounts can operate without proving ownership of the email address. This may be an intentional product choice, but the code contains dormant verification infrastructure and does not make the security trade-off explicit.

**Recommendation**

- Enable verification if email ownership is part of the trust or recovery model.
- If it is intentionally disabled, document the decision and verify that signup abuse controls, recovery behavior, and email-enumeration expectations are acceptable.
- Add an explicit authentication test for the chosen policy so a future configuration change is deliberate.

### 8. Cleanup writes occur on every task request

**Evidence**

- `apps/api/src/routes/tasks.ts:33-41` calls `cleanupExpiredArchivedTasks` in a `preHandler` for every authenticated task request.
- The cleanup implementation performs delete work in `task-service.ts:95-121`.

**Issue**

Read requests can trigger database writes and incur cleanup cost. With SQLite, repeated write cleanup can increase lock contention and make request latency depend on the amount of expired data.

**Recommendation**

- Move cleanup to a scheduled job or an explicit maintenance command.
- If request-triggered cleanup is retained, throttle it per user and time window.
- Add indexes for the cleanup predicates, especially user and archive/deletion timestamps.
- Measure cleanup duration and SQLite lock contention before and after the change.
- Keep cleanup failures from unnecessarily turning otherwise successful reads into failures, while still recording operational errors.

### 9. Search uses leading-wildcard scans

**Evidence**

- `apps/api/src/routes/search.ts:266-313` builds `%query%` `LIKE` expressions across task, project, label, description, and status fields, with joins and scoring.

**Issue**

Leading-wildcard `LIKE` patterns cannot use ordinary B-tree indexes for a prefix, so search can become CPU- and I/O-heavy as a user's data grows and may compete with SQLite writes.

**Recommendation**

- Use SQLite FTS5 for the fields that need free-text search.
- Preserve user ownership and deleted-record filtering in the search design.
- Bound query length as well as page size.
- Add query-duration instrumentation and realistic data-volume benchmarks before changing the implementation.
- Keep the current parameterized SQL and wildcard escaping; those are good defensive practices.

### 10. Domain invariants are not consistently enforced by SQLite

**Evidence**

- `apps/api/src/db/schema.ts:78-131` and the bootstrap schema in `apps/api/src/db/client.ts:300-442` represent several finite-domain values as text without corresponding database `CHECK` constraints.

**Issue**

Direct database writes, imports, migrations, or future code can create invalid statuses, priorities, bucket values, or other domain states that TypeScript types cannot prevent at runtime. SQLite is permissive about storage types, so application-only validation is not a complete integrity boundary.

**Recommendation**

- Add database `CHECK` constraints for finite-domain fields.
- Add ownership, uniqueness, and relationship constraints where they match product rules.
- Validate imported and migrated data before it becomes available to the application.
- Add migration tests for invalid legacy values and define how those values are repaired.

### 11. Recurrence JSON is parsed without a defensive boundary

**Evidence**

- `apps/api/src/services/task-service.ts:501-512` calls `JSON.parse(current.recurrenceRule)` during task completion.
- `apps/api/src/routes/search.ts:111-135` also parses stored recurrence data when mapping search results.

**Issue**

A malformed stored value can turn a normal task completion, list, or search operation into a `500` response. Legacy data, manual database edits, or an incomplete migration can create this condition.

**Recommendation**

- Validate recurrence data at the write boundary with a runtime schema.
- Validate or safely normalize stored values when reading them.
- Decide whether malformed recurrence should be treated as `null` with structured logging or rejected as a targeted data-integrity error.
- Add tests for malformed JSON and structurally invalid recurrence rules.

## Priority 3: CI and delivery maintainability

### 12. Docker smoke CI lacks guaranteed cleanup

**Evidence**

- `.github/workflows/ci.yml:207-225` starts the Compose stack and prints logs on failure.
- Unlike the API-native job at `.github/workflows/ci.yml:297-299`, this job has no `if: always()` teardown step.

**Issue**

A failed smoke test can leave containers and volumes running for the remainder of the job. GitHub-hosted runners are disposable, but the workflow is less predictable and is not safe to reuse on persistent runners.

**Recommendation**

Add a teardown step after log collection:

```yaml
- name: Stop containers
  if: always()
  run: docker compose -f docker-compose.yml -f docker-compose.ci.yml down -v
```

Keep log collection before teardown and upload the logs as an artifact when diagnosing persistent failures.

### 13. Docker smoke CI uses a fixed sleep despite readiness polling

**Evidence**

- `.github/workflows/ci.yml:207-213` runs `sleep 5` before `pnpm smoke:docker`.
- The smoke script already performs service readiness polling (`scripts/docker-smoke.sh`).

**Issue**

The fixed delay adds unnecessary latency when services are ready quickly and does not guarantee readiness when startup is slower than five seconds.

**Recommendation**

- Remove the fixed sleep.
- Make the smoke script the single readiness authority.
- Where supported, use Docker healthchecks and `docker compose up --wait`.
- Keep timeout and failure diagnostics in the readiness script.

### 14. E2E failures have limited first-failure diagnostics

**Evidence**

- `apps/frontend/playwright.config.ts:8-17` sets `retries: 0` and `trace: 'on-first-retry'`.
- `.github/workflows/ci.yml:143-148` uploads only the HTML report.

**Issue**

A transient browser or startup failure has no retry and may have no trace. The report alone may not contain enough network, DOM, or timing context to diagnose the failure.

**Recommendation**

- Use `retries: process.env['CI'] ? 1 : 0` if a retry is appropriate for this suite.
- Change tracing to `retain-on-failure` or otherwise capture a trace for the first CI failure.
- Upload `apps/frontend/e2e/test-results/` in addition to the HTML report.
- Preserve API and frontend process logs as CI artifacts.
- Add an `always()` cleanup step that terminates both background processes.

Retries should not hide flaky tests: track retry counts and fix recurring failures rather than increasing retries indefinitely.

### 15. E2E background processes do not propagate exit status

**Evidence**

- `.github/workflows/ci.yml:129-136` starts the API and frontend with `&` and only waits for HTTP availability.

**Issue**

A process can start, serve briefly, crash, and leave the workflow with misleading diagnostics. Process output and exit codes are not explicitly collected.

**Recommendation**

- Use a process supervisor or track both PIDs explicitly.
- Redirect process output to files and upload those files on failure.
- Check process liveness during the test run where practical.
- Terminate both processes in an `if: always()` cleanup step.

### 16. The CI path filter is difficult to reason about for workflow changes

**Evidence**

- `.github/workflows/ci.yml:4-17` uses `paths-ignore` and attempts to re-include `.github/workflows/ci.yml` with `!.github/workflows/ci.yml`.

**Issue**

Workflow changes are security-sensitive, but the current negative filter and exception are not an obvious trigger contract. A workflow-only change could accidentally skip the validation expected for the change.

**Recommendation**

- Prefer positive `paths` rules when the desired trigger set is finite and clear.
- Explicitly include application source, dependency/configuration files, Docker files, scripts, and workflow files that should trigger CI.
- Add a documented trigger matrix or a small validation workflow for `.github/**` changes.
- Verify behavior with representative workflow-only and documentation-only changes.

### 17. `lint:fix` masks command failures

**Evidence**

- `package.json:23` ends the recursive fix command with `2>/dev/null || true`.

**Issue**

A failed package lint-fix command can be reported as successful, and redirecting stderr removes useful diagnostics.

**Recommendation**

- Remove `|| true`.
- Keep optional-package handling explicit if a package genuinely lacks the script.
- Keep `lint:fix` separate from the blocking `lint` check and ensure both return meaningful exit codes.

## Priority 4: Dependency and release reproducibility

### 18. Runtime dependencies use broad semver ranges

**Evidence**

- The root and application manifests use many `^` dependency ranges, for example `package.json:44-55`.
- Workspace references use `workspace:*`.

**Issue**

The lockfile makes the current installation reproducible, but future lockfile updates can introduce behavior changes across the monorepo. Runtime and security-sensitive dependency upgrades are not clearly separated from routine updates.

**Recommendation**

- Continue requiring `pnpm install --frozen-lockfile` in CI.
- Use grouped, reviewed automated dependency updates with required tests.
- Consider narrower ranges or exact pins for high-risk runtime and native dependencies.
- Document the dependency-update and vulnerability-exception policy.
- Review lockfile changes as behavior changes, not just housekeeping.

This is not a recommendation to remove the lockfile or immediately pin every package; the goal is controlled, reviewable updates.

### 19. Docker images are not immutable by digest or release identifier

**Evidence**

- `apps/api/Dockerfile:3,33` and the frontend Dockerfile use version tags rather than digests for base images.
- `docker-compose.hub.yml:3,24` deploys application images tagged `latest`.

**Issue**

A tag can move, so the same source and lockfile may produce different images over time. `latest` also makes rollback and incident reproduction ambiguous.

**Recommendation**

- Pin base images to reviewed digests and update them through automation.
- Publish application images with immutable version and commit-SHA tags.
- Deploy a release-specific tag or digest instead of `latest`.
- Generate an SBOM and scan the final images as part of release CI.
- Keep a documented mapping between a release and its image digests.

## Additional findings from the full review

### 20. Loading state can be imbalanced with concurrent requests

**Evidence**

- `apps/frontend/src/app/core/interceptors/loading.interceptor.ts:17-30` uses a per-request `startedAt` and a `setTimeout` before `stopLoading()`.
- `apps/frontend/src/app/core/services/status.service.ts:17-27` uses a reference-counted `_loadingCount` signal.

**Issue**

The `StatusService` is correctly reference-counted, so the main imbalance risk is the delayed `stopLoading()` timer: a fast request can decrement the count while a slower request is still in flight, or a delayed timer can fire after the user has navigated away. The existing interceptor test does not cover overlapping requests.

**Recommendation**

- Add concurrency tests for overlapping fast and slow requests.
- If delayed stopping is desired, cancel or version the timer when a newer request starts.
- Consider whether a minimum-display delay is worth the added complexity; the reference-counted signal already prevents the most common spinner bug.

## Recommended implementation order

1. Make CI failures blocking and add Docker/E2E cleanup and diagnostics.
2. Add the task self-parent regression fix and test.
3. Decide and document the email verification policy; prevent production email fallback logging and escape HTML values.
4. Document the supported proxy topology and harden `trustProxy` accordingly.
5. Consolidate schema evolution into the existing Drizzle migrations and test upgrades from existing database versions.
6. Add database constraints and recurrence validation.
7. Benchmark search and move to FTS5 if real data shows the current query is a bottleneck.
8. Improve image immutability and dependency-update controls.

## Existing controls worth preserving

- CI installs dependencies with `pnpm install --frozen-lockfile`.
- Production startup rejects missing or placeholder Better Auth secrets.
- Protected routes use authentication middleware and owner-scoped queries.
- Search uses parameterized SQL and escapes wildcard characters.
- API and nginx responses set security headers.
- Foreign keys and transactions are already used for important database operations.
- Containers drop capabilities, use `no-new-privileges`, use a read-only root filesystem, and run the API as a non-root user.
- The project has broad API, frontend, OpenAPI, Docker, and smoke-test coverage.

These controls should remain part of the baseline while the findings above are addressed.
