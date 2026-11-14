# Plan: iCalendar export and a subscribed calendar feed

> **Archived 2026-11-12 — abandoned.** The outbound-only design (download an
> `.ics` and subscribe to a token URL) was dropped after review: publishing
> casual tasks into a calendar is low value, and the product direction moved to
> inbound read-only calendar events. Kept for context only. The current plan is
> [docs/plans/2026-11-12-inbound-calendar-read-only.md](../plans/2026-11-12-inbound-calendar-read-only.md).
> See [docs/archive/README.md](./README.md) for the archival policy.

**Date:** 2026-11-12
**Status:** Abandoned
**Related:**
- `docs/plans/2026-10-28-what-to-tackle-next.md` — board triage; calendar sync was never tracked
- `docs/plans/2026-11-04-comprehensive-ux-review.md` — UX findings on the calendar surface
- `apps/frontend/src/app/features/personal/utils/calendar-view.ts` — how tasks map onto calendar days
- `apps/api/src/services/task-service.ts` — recurrence materialisation and task writes
- `docker/nginx.conf` — the bundled reverse proxy that fronts the API at `/api`
- `packages/shared/src/domain.ts` — `Task`, `RecurrenceRule`, `Priority`

**Revision notes (2026-11-12 review):** the series is now exported from its single
*open* row with a stable UID and the RRULE re-anchored on that row, which removes
the template/instance special-casing and the historical replay; the projection is
bounded (seven occurrences unless `endDate` applies) and timed tasks carry a
nominal one-hour duration, both matching Todoist's published feed behaviour; the
feed supports conditional GET and advertises a one-hour refresh, with the
Settings copy setting per-client expectations (§7.4); the subscribe URL is built
from configuration instead of `request.origin`; the nginx access log is covered
alongside pino; cache headers, UTF-8 line folding, timed `UNTIL`, and the
download plumbing are specified. §9 records the residual RRULE divergence.

---

## 1. Goal

Let a person see their Yotara tasks in the calendar application they already use, in two ways:

1. **Download** their tasks as an `.ics` file and open or import it locally.
2. **Subscribe** to a calendar URL so Google Calendar, Apple Calendar, or Outlook keeps it up to date on its own.

Both directions are one-way: Yotara pushes to the calendar app, and changes made in the calendar app do not come back.

This plan covers both. It does **not** cover importing `.ics` files, CalDAV, or two-way sync with any provider — see §10.

## 2. What exists today

### 2.1 The task date model

`apps/api/src/db/schema.ts:89-116` stores dates as three TEXT columns:

| Column | Type | Shape | Notes |
|:---|:---|:---|:---|
| `due_date` | TEXT | `YYYY-MM-DD` | Written by the client as a date-only string |
| `due_time` | TEXT | `HH:mm` | Wall-clock time of day; requires a due date |
| `recurrence_rule` | TEXT | JSON blob | `{ frequency, interval, endDate?, daysOfWeek? }` |

Two things follow from this shape:

- **There is no end date, no duration, no all-day flag, and no timezone.** A task is a day, optionally with a time on that day. There is no per-user timezone column either — the browser's zone is sent per request as a `tz` query parameter (`apps/api/src/routes/tasks.ts:96`) and is never persisted.
- **`due_date` holds two different formats.** Client writes produce `YYYY-MM-DD`; recurrence materialisation writes a full ISO timestamp, because `advanceDueDate` returns `DateTime.toISO()` (`apps/api/src/services/task-service.ts:396-444`). Every reader copes by slicing (`task-service.ts:53`) or by using SQL `date(due_date)` (`task-service.ts:224-227`). Any new date consumer has to do the same.

### 2.2 Recurrence is materialise-on-complete

`apps/api/src/services/task-service.ts:644-694`. When a recurring task is completed, the *next* instance is created as a new row:

- The first row of a series is the **template**. It carries `recurrence_rule` and has `base_task_id = NULL`.
- Each completion spawns an instance with `base_task_id` pointing at the template (`base_task_id: current.baseTaskId ?? current.id`, line 686). **The instance copies `recurrence_rule` as well** (line 685), so the rule is never only on the template.
- The completed row is archived (`task-service.ts:591-596`), so a series has **exactly one open row at a time** — the next occurrence.
- Recurrence stops at `rule.endDate` (line 659) or after 365 instances (line 670).
- `daily`, `weekdays`, and `weekly`-with-`daysOfWeek` anchor the next occurrence on `nowIsoTimestamp()`, not on the previous due date (`task-service.ts:649-653`). Completing late moves the series forward; it does not backfill.

There is **no expansion anywhere**. The calendar maps one row to one day via `dueDate.slice(0, 10)` (`apps/frontend/src/app/features/personal/utils/calendar-view.ts:35-37`), so the app shows exactly one row per materialised instance.

The internal rule shape is a small subset of RFC 5545:

| `frequency` | Meaning | `interval` | `daysOfWeek` |
|:---|:---|:---|:---|
| `daily` | every N days | yes | — |
| `weekdays` | every Monday–Friday | ignored | — |
| `weekly` | every N weeks | yes | optional, `0=Sun`…`6=Sat` |
| `monthly` | every N months | yes | — |
| `yearly` | every N years | yes | — |

`endDate` is an ISO date after which the series stops. There is no `COUNT`, no `UNTIL` time component, no `BYMONTH`, and no per-month weekday (`BYDAY=2TU`).

### 2.3 Write, delete, and change-tracking semantics

- `PATCH /tasks/:id` is a partial update: absent fields keep their value, `null` clears a date (`apps/api/src/services/task-service.ts:563-793`).
- `updatedAt` is rewritten on every patch (`task-service.ts:713`). `createdAt` is set at insert.
- **`deletedAt` exists but is never written.** `DELETE /tasks/:id` is a hard delete (`task-service.ts:806-839`); `deleted_at` is only ever read as `IS NULL` in filters and is purged by `cleanupExpiredArchivedTasks`. New code must still filter it, because rows written by older versions can carry it.
- **Deleting a template cascades to its instances in the same transaction** (`task-service.ts:818-828`), so the API write path does not orphan anything. `base_task_id` is `ON DELETE SET NULL` (`apps/api/src/db/client.ts:97`), which only fires on the bulk delete paths: `cleanupExpiredArchivedTasks` (`task-service.ts:112-123`) and `clearCompletedTasksForOwner` (`task-service.ts:134-148`).
- Tasks get `archivedAt` stamped the moment they are completed (`task-service.ts:591-596`). With the default `archiveAutoDelete = true`, completed rows — including completed templates — are hard-deleted 30 days later by the cleanup that runs on every tasks request (`apps/api/src/routes/tasks.ts:75-81`). An open instance then loses `base_task_id` and becomes the series' new first row.
- **There is no change cursor.** `GET /tasks` orders by `sort_order, created_at` (`task-service.ts:339`), there is no `updatedAt` index, and no `?updatedSince=` filter. No ETag, no `If-Match`, no version column.

### 2.4 Auth and infrastructure

- Better Auth is configured with `emailAndPassword` only (`apps/api/src/lib/auth.ts:44-125`). The `account` table's `accessToken`/`refreshToken` columns are vestigial — only `providerId='credential'` rows are ever read.
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production (`apps/api/src/lib/auth.ts:114-117`).
- Every application route except `/`, `/health`, and `/config` requires a session (`requireAuthenticatedUser`, `apps/api/src/plugins/auth-required.ts`); the check is attached per route file, not globally.
- CORS allows the configured origins with `credentials: true` (`apps/api/src/plugins/cors.ts`).
- The only background job is an hourly `setInterval` that deletes unverified accounts (`apps/api/src/lib/email-cleanup.ts:72-96`). Everything else is request-driven.
- The only outbound HTTP client is Resend (`apps/api/src/lib/email.ts`).
- **The API is normally reached through nginx.** Compose serves the SPA at the origin root and proxies `location ^~ /api/` to `http://api:3000/` (`docker/nginx.conf:110-117`), stripping the `/api` prefix. `environment.prod.ts` calls the API at `/api`. nginx's default access log writes `$request` — the full URI **including the query string** — to stdout.
- Fastify runs with `logger: true` and no custom serializers (`apps/api/src/server.ts:57`), so pino's default `req` serializer also logs the full request URL including its query string.
- `APP_BASE_URL` is the public origin (`DOCKER.md:109`); `TRUST_PROXY` defaults to the Compose network (`172.16.0.0/12`) and is unset for direct deployments (`apps/api/src/lib/trusted-proxy.ts`).

### 2.5 What already exists that we reuse

- **Export plumbing.** `downloadCsv` / `downloadJson` in `apps/frontend/src/app/shared/utils/export.ts`, wired into the Settings page for tasks, projects, and labels (`settings-page.component.ts:996-1149`). The API's `?export=true` on `GET /tasks` only forces `pageSize=10000` — it is not a streaming export.
- **Shared package.** `packages/shared` is imported by both the API and the frontend through two barrels that re-export the same modules (`index.ts` for Node, `frontend.ts` for the bundler). It already hosts pure logic such as `name-key.ts` and `label-colors.ts`. The API's tsconfig maps `@yotara/shared` to the package's **source** (`apps/api/tsconfig.json:paths`), while `tsconfig.build.json` maps it to `dist`, so tests run against source and production against the build.
- **API client conventions.** `packages/shared/src/auth.ts` centralises JSON calls with `credentials: 'include'` (line 37-39) but keeps `apiBaseUrl` module-private and always parses JSON. The frontend separately exposes `environment.apiBaseUrl`, which is `/api` in production and `http://localhost:3000` in development.
- **iCalendar-adjacent code: none.** The repository contains no `.ics`, `VEVENT`, `RRULE`, or `CalDAV` code outside one comment in `task-service.ts:415`.

## 3. Product decisions

1. **Two features, one builder.** A `.ics` download and a subscribed feed are the same document served two ways. The serialiser lives in `packages/shared/src/ics.ts` as pure functions so it is testable in isolation and import will reuse it later (§10). The browser does **not** run the builder: the download calls the route and saves the blob (§7.1), so the two surfaces cannot drift because there is only one code path.
2. **The feed is one-way and the UI says so.** Yotara pushes; the calendar app pulls. Nothing is imported back, and edits made in Google Calendar are not reflected in Yotara. The Settings copy states this plainly next to the subscribe URL.
3. **The feed URL carries a bearer token, not a session.** Calendar clients fetch the URL from their own servers without cookies, so the route needs a credential of its own. The token is stored **SHA-256 hashed** and looked up by hash, so a database leak does not hand out working feed credentials.
4. **The token is rotatable and revocable.** Mint, rotate, and revoke are explicit actions in Settings. Rotating invalidates every existing subscription URL immediately.
5. **One route, two ways in.** `GET /calendar.ics` accepts either the session cookie (used by the in-app download) or `?token=` (used by subscribers). The behaviour is identical; only the credential differs.
6. **Times are floating local times.** Yotara stores no timezone and uses the browser's zone, so `DTSTART:20260912T090000` — which a reader interprets in the viewer's own zone — is the honest representation. It also avoids shipping `VTIMEZONE` components.
7. **A series is one `VEVENT` with a stable UID, exported from its open row.** The feed selects rows the same way the app does — open, dated, top-level — and because materialisation keeps exactly one open row per series, the series falls out as one event. Its `UID` is the series identity (`baseTaskId ?? id`), so completing an occurrence moves the same event to the next date instead of deleting and recreating it. The RRULE is re-anchored on that open row's date at every fetch, so the feed never replays history and never shows occurrences the app has already resolved. The projection is bounded to seven occurrences unless `endDate` shortens it (§4.3), so a daily task cannot fill the calendar. Residual divergences are listed in §9.
8. **Only active, dated, top-level tasks appear.** Subtasks belong to their parent, tasks without a due date have no place on a calendar, and completed, archived, or soft-deleted rows are omitted — finishing a task clears it from the subscriber's calendar.
9. **`VEVENT`, not `VTODO`.** `VTODO` is semantically truer for a task manager, but Google Calendar ignores `VTODO` entirely and Apple renders it poorly. A calendar feed should be events.
10. **Tasks do not reserve time.** Emitted events carry `TRANSP:TRANSPARENT`, so a task never makes a person look busy.
11. **No new dependencies.** A `VEVENT` is simple enough to serialise directly, and the builder is ~250 lines of pure string work. `ical.js` is only needed if import is ever added (§10).
12. **The subscribe URL needs a publicly reachable HTTPS origin.** Google, Apple, and Microsoft fetch the URL from their own infrastructure. On a LAN-only deployment the download still works and the subscribe URL does not; the Settings copy says so and the URL is only offered when a public origin is configured (§8.4).
13. **Freshness is client-controlled; advertise one hour and set expectations.** The feed carries `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` of one hour. Apple uses that as the default auto-refresh (the user can still choose 5 or 15 minutes per calendar), Outlook runs on its own 1–4 hour schedule, and Google ignores the hint entirely and polls every 12–24 hours. No feed-side change moves Google; the UI states the real delay per client, shows when the data last changed, and keeps the download as the immediate path. A native push integration is the only way to do better and is out of scope (§10).

## 4. The iCalendar document

### 4.1 File structure

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Yotara//Yotara Task Manager//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:<calendar name>
REFRESH-INTERVAL;VALUE=DURATION:PT1H
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:<base task id or task id>@yotara
DTSTAMP:20260912T043000Z
DTSTART;VALUE=DATE:20260912
DTEND;VALUE=DATE:20260913
SUMMARY:Water the plants
DESCRIPTION:Project: Home
CATEGORIES:Errands
PRIORITY:5
TRANSP:TRANSPARENT
STATUS:CONFIRMED
LAST-MODIFIED:20260901T101500Z
END:VEVENT
END:VCALENDAR
```

`REFRESH-INTERVAL` (RFC 7986) and `X-PUBLISHED-TTL` are hints, not controls. Apple uses them to seed the subscription's auto-refresh (default hourly, user-adjustable to 5 or 15 minutes), Outlook runs its own 1–4 hour schedule, and Google ignores both and polls every 12–24 hours. One hour is the honest middle: it matches Apple's default and Outlook's lower bound, and it causes no extra work for Google. A longer hint — six hours, or a day — is what makes the feed *look* broken on the clients that do honour it.

### 4.2 Property mapping

| iCalendar property | Source | Notes |
|:---|:---|:---|
| `UID` | `baseTaskId ?? id` | The series identity. Stable across completion, so a refresh moves the event rather than duplicating it |
| `DTSTAMP` | Server clock | Must be a UTC DATE-TIME |
| `DTSTART` | `due_date` + `due_time` | `VALUE=DATE` when there is no time, floating local DATE-TIME when there is |
| `DTEND` / `DURATION` | Derived | All-day: `DTEND` is the next day, exclusive. Timed: `DURATION:PT1H` — a nominal one-hour block, since Yotara has no duration (§4.4) |
| `SUMMARY` | `tasks.title` | |
| `DESCRIPTION` | `tasks.description` | Project name appended as a `Project: …` line |
| `CATEGORIES` | Label names | Comma-separated; each name escaped individually |
| `PRIORITY` | `tasks.priority` | `high → 1`, `medium → 5`, `low → 9` |
| `STATUS` | — | Always `CONFIRMED`; completed tasks are excluded instead |
| `TRANSP` | — | Always `TRANSPARENT` |
| `LAST-MODIFIED` | `tasks.updated_at` | ISO-8601 UTC from `nowIsoTimestamp`; omitted when unparseable |
| `RRULE` | `recurrence_rule` | See §4.3 |

`VEVENT`s are emitted in a deterministic order — `due_date`, then `UID` — so repeated fetches produce a stable document and subscriber-side diffs stay quiet. An empty calendar is still a valid `VCALENDAR` with no `VEVENT` children.

### 4.3 Recurrence mapping

The rule is read from the exported row itself; instances carry `recurrence_rule`, so no template lookup is needed.

| Yotara | RRULE |
|:---|:---|
| `{ frequency: 'daily', interval: n }` | `FREQ=DAILY;INTERVAL=n` |
| `{ frequency: 'weekdays' }` | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| `{ frequency: 'weekly', interval: n }` | `FREQ=WEEKLY;INTERVAL=n` |
| `{ frequency: 'weekly', interval: n, daysOfWeek: [...] }` | `FREQ=WEEKLY;INTERVAL=n;BYDAY=…` |
| `{ frequency: 'monthly', interval: n }` | `FREQ=MONTHLY;INTERVAL=n` |
| `{ frequency: 'yearly', interval: n }` | `FREQ=YEARLY;INTERVAL=n` |
| any rule with `endDate` | `;UNTIL=20260912` (all-day) or `;UNTIL=20260913T235959Z` (timed) |
| any rule without `endDate` | `;COUNT=7` |

`UNTIL` has to match `DTSTART`'s value type, or a strict parser rejects the file. For a timed (floating) `DTSTART`, RFC 5545 requires `UNTIL` in UTC, but `endDate` is a local date; `endDate + 1 day at 23:59:59Z` covers an evening occurrence in any real offset without extending the series by a whole occurrence. `weekdays` ignores `interval` internally, so the emitted rule carries no `INTERVAL`.

**The projection is bounded.** Without a bound, a rule with no `endDate` expands forever — a daily task would put hundreds of events in the subscriber's calendar on the first fetch. Emit `COUNT=7`, which matches Todoist's project calendar feed: the calendar shows the next seven occurrences and the window rolls forward as each is completed, because the RRULE is re-anchored on the open occurrence (§3.7). When `endDate` is present, emit `UNTIL` and no `COUNT` — RFC 5545 §3.3.10 forbids the two together, and the user's own end date is already the tighter bound they asked for.

### 4.4 RFC 5545 conformance details

These are the parts that are easy to get wrong and that break parsers when they are:

- **CRLF line endings.** RFC 5545 requires `CRLF`, not `LF`. The document ends with a trailing `CRLF`.
- **Line folding at 75 octets.** Longer content lines are split with `CRLF` followed by a single space. The limit is in **octets, not characters** — a title of 40 emoji is far more than 75 bytes, and folding on character count produces lines a parser rejects. Continuation lines hold 74 octets because the leading space counts toward the limit. Fold at **UTF-8 codepoint boundaries**: iterate the encoded bytes but never split a multibyte sequence, or the line decodes as replacement characters.
- **TEXT escaping.** `\` → `\\`, `;` → `\;`, `,` → `\,`, newline → the literal two-character sequence `\n`. `CATEGORIES` escapes each name individually and joins them with unescaped commas.
- **All-day `DTEND` is exclusive**, so an event on the 12th ends on the 13th.
- **Timed events carry a nominal one-hour duration.** Emit `DURATION:PT1H` rather than a zero-length `DTSTART`/`DTEND` pair. RFC 5545 permits a DATE-TIME `DTSTART` with no `DTEND` (zero duration), but calendar clients render point-in-time events inconsistently — often as a dot or an invisible sliver — and Todoist renders timed tasks as one-hour events, which is what subscribers expect. Yotara has no duration field, so one hour is a presentational default, not a claim about how long the task takes. `TRANSP:TRANSPARENT` (§3.10) keeps the block from making the person look busy. If a real duration is ever stored, it replaces the constant.
- **Date arithmetic must not touch the local clock.** All-day `DTEND` is computed with `Date.UTC`, and `YYYY-MM-DD` strings are parsed as UTC, so a DST boundary cannot shift an event onto the wrong day.

### 4.5 Selection rules

A row is exported when **all** of these hold:

| Condition | Rule |
|:---|:---|
| Not a subtask | `parent_id IS NULL` |
| Dated | `due_date IS NOT NULL` |
| Not completed or archived | `completed = 0 AND archived_at IS NULL` |
| Not soft-deleted | `deleted_at IS NULL` (rows from older versions may still carry it) |

There is no template/instance special case. Because a completion archives the old row and creates exactly one new open row (§2.2), a recurring series contributes exactly its current occurrence. The exported row carries its own `recurrence_rule`, `base_task_id`, `due_time`, project, and labels, so the builder needs no joins beyond label and project names.

Consequences worth stating:

- A completed series (or one past `endDate`) has no open row and disappears from the feed, which is the correct "finish it and it's gone" behaviour.
- When the 30-day archive purge deletes a completed template, the open instance loses `base_task_id`. Its `UID` changes once, from the template id to its own id, and the series continues; see §9.
- `parent_id` is `ON DELETE SET NULL` (`client.ts:95`) but the service cascade-deletes subtasks (`task-service.ts:818-822`), so orphaned subtasks are not expected. If one appears, it has no `parent_id` and will be exported as a normal task — an acceptable failure mode.

## 5. Endpoint design

### 5.1 `GET /calendar.ics`

- **Auth:** session cookie **or** `?token=<token>`. The route cannot use the file-level `requireAuthenticatedUser` preHandler that `routes/me.ts` uses; it implements a custom preHandler that tries the session first and falls back to the token.
- **Response:** `200` with `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="yotara-calendar.ics"`, and the document body. The attachment header makes the in-app download and any direct link save under a sensible name.
- **Caching:** `Cache-Control: private, no-cache, max-age=0, must-revalidate`. `private` keeps the response out of shared proxies and CDN caches — the body is one person's task list and the URL is a bearer credential — while `no-cache` lets the calendar client keep the document and revalidate it, which is what makes the conditional GET below useful. `no-store` would forbid storing it altogether and defeat the 304 path.
- **Conditional GET:** send `Last-Modified` (the newest `updated_at` in the feed, floored to the second) and a strong `ETag` (a hash of the rendered body). Honour `If-None-Match` and `If-Modified-Since` with `304 Not Modified` and an empty body. Subscriber clients re-download the whole document on their own schedule, so this is where the bandwidth and CPU are saved; Google's fetch guidance also favours a `Last-Modified` it can compare.
- **`401`** when neither credential is valid. Calendar clients surface the subscription as failing, which is the correct signal after a revoke; they retry on their own schedule.
- **Rate limit:** the global limiter is per-IP at 200 requests/minute (`server.ts:67-74`). Per-IP is the wrong axis for subscriber traffic, which arrives from shared cloud egress ranges. Use a per-route limit (`config.rateLimit`, as `routes/me.ts` already does for account deletion) keyed by the **token hash** for token requests and by `userId:ip` for session requests, with a generous per-token ceiling. The token's 256 bits make enumeration infeasible; the limit is there to bound work, not to stop guessing.
- **Query string:** the token arrives in the query string, so both the API logger and nginx must not record it (§6.3).

### 5.2 `GET /me/calendar-token`

Returns the current feed state: `{ enabled: boolean, url: string | null, lastChangedAt: string | null }`. `url` is the absolute subscribe URL and is `null` when no token is set. `lastChangedAt` is the newest `updated_at` among the rows the feed would export — the same value used for the `Last-Modified` header — so Settings can say "your tasks last changed 2 hours ago" and distinguish a stale Yotara from a calendar client that simply has not fetched yet. The raw token is **not** returned by this endpoint — it is shown once, at mint time.

**Do not build the URL from `request.origin`.** Under the bundled deployment the API lives at `/api` (`docker/nginx.conf:110`), so `request.origin` yields `https://host` and the URL would point at the SPA, not the feed. `request.protocol` is also only trustworthy when `TRUST_PROXY` matches the proxy, which a bare deployment does not configure.

Resolve the public API base explicitly, in this order:

1. `PUBLIC_API_URL`, when set (a split-origin deployment, or an API mounted at the root).
2. `APP_BASE_URL`, appending `/api` unless its path already ends in `/api` (the bundled Compose setup serves the feed at `https://host/api/calendar.ics`).

Both are already documented in `DOCKER.md`; this adds no required configuration for the common setup. When neither yields an `https://` URL, the subscribe half of the Settings section is hidden and only the download is offered (§3.12).

### 5.3 `POST /me/calendar-token`

Mints a token if there is none, or replaces it (rotation). Returns `{ url }` containing the raw token, exactly once. Requires a session.

### 5.4 `DELETE /me/calendar-token`

Revokes the token. The column is set back to `NULL`; existing subscribe URLs stop working immediately.

### 5.5 Token handling

- 32 random bytes from `crypto.randomBytes`, Base64url encoded (43 characters). Never `Math.random`.
- Stored as `user.calendarToken` holding the **SHA-256 hash** of the token, never the token itself. SHA-256 is appropriate here precisely because the input is high-entropy; a password hash would add cost without adding security. Lookup by hash equality needs no `timingSafeEqual` because the stored value never leaks a usable token.
- Lookup is `WHERE calendarToken = <sha256(candidate)>`, so the stored value is useless on its own.
- Rotation overwrites the hash; revocation clears it.
- The token is a bearer credential for a read-only feed of one person's tasks. It grants no write access and no access to anything else in the account.
- `calendarToken` must not be selected into `toPublicUser` (`apps/api/src/lib/public-user.ts` enumerates fields, so it is safe today) and must not be added to Better Auth's `user.additionalFields`, which would return it in session responses. Both are covered by a test.

### 5.6 Schema change

One nullable column on the existing `user` table:

```ts
export const users = sqliteTable('user', {
  // …
  calendarToken: text('calendarToken'),
});
```

The API bootstraps its schema on startup (`apps/api/src/db/client.ts:305`), so the column is added by an `ALTER TABLE user ADD COLUMN calendarToken TEXT` guard alongside the existing ones (`client.ts:315-329`), and to the `CREATE TABLE IF NOT EXISTS user` bootstrap block (`client.ts:13-26`). No migration file is required, matching how `workspaceMode` and `onboardingCompleted` were introduced. Existing column names are camelCase in both the Drizzle schema and the bootstrap SQL, so `calendarToken` follows suit.

## 6. Security

### 6.1 The token is a bearer credential

Anyone holding it can read the task list of that account. It is therefore hashed at rest, rotatable, revocable, and scoped to one read-only feed.

### 6.2 The feed is read-only

`GET /calendar.ics` has no side effects. There is no write path through a token.

### 6.3 The token must not reach any log

There are two log streams, and both record the full request URI today:

- **pino.** Fastify runs with `logger: true` and no custom serializers (`server.ts:57`), so the default `req` serializer writes the URL — query string included. Add an explicit logger configuration with a `req` serializer that strips the query string, applied to every request. This is a general improvement: no endpoint should log query strings verbatim.
- **nginx.** The bundled proxy uses the default access log, whose `combined` format contains `$request` — the full URI including the query string — written to stdout. Add a `log_format` and an `access_log` for the `location ^~ /api/` block that records `$uri` instead of `$request` (or drop the access log for that location). This is operator-visible configuration, so it belongs in `docker/nginx.conf` and `DOCKER.md`.

Edge logs (Cloudflare or another CDN) are outside the application's control. `DOCKER.md` should state that anyone terminating TLS in front of Yotara should not log query strings for the feed path.

### 6.4 The response must not be cached by a shared proxy

`Cache-Control: private, no-cache, max-age=0, must-revalidate` (§5.1) keeps one person's feed out of CDN caches: `private` forbids shared storage, and `no-cache` forces revalidation instead of serving a stale copy. `no-store` is deliberately not used, because it would also prevent the client from keeping the document and sending `If-None-Match`. A token URL is not a cache key the operator controls, and `text/calendar` is exactly the kind of response a proxy may cache without explicit headers.

### 6.5 Nothing else changes

No new CORS origins, no new CSP directive, no new secret in the environment. The feed is `text/calendar` and contains no markup, so it is not a scripting surface. `Referrer-Policy: no-referrer` is already set on every response, so the token cannot leak through a referrer even if the URL is opened in a browser.

## 7. Frontend experience

A new **Calendar** section in Settings, placed after the existing Export section.

### 7.1 Download

A **Download .ics** button. It calls `GET /calendar.ics` with the session cookie, reads the response as a blob, and saves it as `yotara-calendar.ics` (the server's `Content-Disposition` supplies the same name for direct links).

Implementation notes:

- Use `environment.apiBaseUrl` (`/api` in production, `http://localhost:3000` in development) and pass `credentials: 'include'`. `packages/shared/src/auth.ts`'s `request()` is unsuitable: it forces JSON parsing and keeps its base URL module-private. Either add a small `calendars.download()` helper in shared that returns a `Blob`, or use the environment value directly. Do not reach into `auth.ts` internals.
- `SameSite=Lax` is not the reason to use `fetch`. Lax **does** send cookies on top-level GET navigations, and in production the API is same-origin at `/api`. The constraint is that cross-origin `fetch` defaults to `credentials: 'same-origin'`, so development (port 4200 → 3000) needs `credentials: 'include'`. Stating the real reason keeps the next reader from "optimising" it away.

### 7.2 Subscribe

- The subscribe URL in a read-only field with a **Copy** button.
- **Rotate** and **Revoke** actions, with the rotate action confirming that existing subscriptions will stop working.
- The URL is shown only after it is minted. Because the raw token is stored only as a hash, the Settings page cannot re-display it later — so the UI shows it once and offers a copy button at that moment, plus a rotation path if it is lost. This is a deliberate trade-off for not storing the token in the clear.
- When no public HTTPS base is configured, hide the subscribe controls and show the download only (§5.2).

### 7.3 Copy

Short, non-technical instructions naming the three clients that matter: Google Calendar (*Other calendars → Add calendar → From URL*), Apple Calendar (*File → New Calendar Subscription*), and Outlook (*Add calendar → Subscribe from web*).

### 7.4 Honest copy and the freshness affordance

The section states these things plainly:

- The feed is **read-only**; changes made in the calendar app do not come back to Yotara.
- Calendar apps choose when to fetch. Apple is usually the fastest (hourly by default; you can set 5 or 15 minutes in *Get Info → Auto-refresh*), Outlook is typically 1–4 hours, and Google is 12–24 hours with **no manual refresh**. The feed advertises a one-hour refresh, but each app decides whether to honour it.
- **Need it now?** Apple users can force a refresh (⌘R on macOS, pull down on iOS). On Google and Outlook, the reliable immediate path is the **Download .ics** button: import it and the current state is there right away.
- The subscribe URL only works if Yotara is reachable at a **public HTTPS address**. On a LAN-only deployment the download still works and the subscribe URL does not.
- A recurring task shows its next seven occurrences in the calendar, while Yotara schedules one occurrence at a time. Completing an occurrence moves the same calendar event to the next date and rolls the window forward. For monthly or yearly rules, a projected occurrence may land on a day Yotara would shift (e.g. the 31st), so the app is authoritative once the occurrence is reached.

Next to the copy, the section shows **"Your tasks last changed: 2 hours ago"** from `lastChangedAt` (§5.2). That is the anti-"is it broken?" signal: it separates "Yotara has not changed anything" from "your calendar app has not fetched yet", which the user can then act on with the refresh guidance above.

## 8. Implementation outline

### 8.1 New files

| File | Purpose |
|:---|:---|
| `packages/shared/src/ics.ts` | Pure iCalendar serialiser: `buildIcs`, `buildIcsRrule`, `escapeIcsText`, `foldIcsLine`, `formatIcsDate`, `formatIcsTime`, `formatIcsUtcStamp`, `addIcsDays` |
| `apps/api/src/lib/calendar-token.ts` | `mintCalendarToken`, `hashCalendarToken`, `findUserByCalendarToken`, `revokeCalendarToken`, `resolvePublicApiBase` |
| `apps/api/src/lib/calendar-feed.ts` | Assemble one user's rows into `IcsTaskInput[]` — the join with label names and project names |
| `apps/api/src/routes/calendar.ts` | `GET /calendar.ics` plus the three `/me/calendar-token` endpoints |
| `apps/api/src/lib/ics.test.ts` | The serialiser, under `node:test` (see §8.4 on placement) |
| `apps/api/src/lib/calendar-token.test.ts` | Token minting, hashing, lookup, rotation, URL resolution |
| `apps/api/src/routes/calendar.test.ts` | Route behaviour: both auth paths, revocation, feed contents, headers |
| `apps/frontend/e2e/specs/authenticated/calendar-feed.spec.ts` | Download and subscribe-URL flows. **`calendar.spec.ts` already exists** for the calendar view — do not overwrite it |

`selectIcsTasks` moves out of the shared serialiser: selection is a database concern that depends on `completed`, `archived_at`, `deleted_at`, and `parent_id`, so it belongs next to the query in `calendar-feed.ts`. The shared module stays a pure row → string transform.

### 8.2 Modified files

| File | Change |
|:---|:---|
| `packages/shared/src/index.ts` | Export `./ics.js` |
| `packages/shared/src/frontend.ts` | Export `./ics` |
| `apps/api/src/db/schema.ts` | `calendarToken` column on `users` |
| `apps/api/src/db/client.ts` | Bootstrap SQL entry and an `ALTER TABLE user ADD COLUMN` guard |
| `apps/api/src/server.ts` | Register the calendar routes; add the query-stripping logger serializer |
| `apps/api/src/docs/openapi.ts` | Schemas for the four endpoints, including a `text/calendar` response — `withJsonResponse` cannot model it, and `pnpm docs:check` enforces the spec |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | The Calendar section |
| `packages/shared/src/auth.ts` | Client methods for the three token endpoints, plus the blob download helper (or export the base URL) |
| `apps/frontend/src/app/core/services/auth-state.service.ts` | Forward the token methods |
| `docker/nginx.conf` | Access-log format that omits the query string for `/api/` |
| `docs/README.md` | Add this plan to the Active plans table |
| `README.md` | A row in the feature table |
| `DOCKER.md` | `PUBLIC_API_URL` (optional), the public-HTTPS requirement, and the query-string logging caveat |

### 8.3 Work breakdown

Three reviewable pull requests. Each lands green on its own.

| Part | Result | Depends on |
|:---|:---|:---|
| **1. Shared serialiser** | None — a tested pure module, no route and no UI | — |
| **2. API feed** | A working `GET /calendar.ics` reachable by URL | 1 |
| **3. Settings surface** | Download button, subscribe URL, rotate and revoke | 2 |

Part 2 is the risky one and should be reviewed on its own: it introduces the credential, the schema change, the URL resolution, and the two logging changes.

### 8.4 Before starting

- Confirm the public API base the subscribe URL will use: `PUBLIC_API_URL` if set, otherwise `APP_BASE_URL` + `/api` in the bundled Compose setup. Verify it over HTTPS from outside the host.
- Record a green baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm docs:check`.
- No database migration file is needed; the runtime bootstrap handles the new column.
- Tests: `apps/api/package.json` runs `tsx --test src/**/*.test.ts`, and its tsconfig maps `@yotara/shared` to the package source, so a test under `apps/api/src/lib/` can exercise the shared serialiser without a build (`label-name.test.ts` follows the same pattern). Alternatively add a `test` script to `packages/shared` (it currently has only `test:coverage: echo 'No tests in shared package'`) and keep `ics.test.ts` beside the module — preferable if the serialiser keeps growing, because `pnpm -r test` would then run it in the right package.

## 9. Risks and limitations

| Risk | Mitigation |
|:---|:---|
| **The token reaches the logs** | pino `req` serializer strips the query string, and the nginx `/api/` access log records `$uri` instead of `$request` (§6.3). Verified by a test that inspects the logged URL and by a smoke check of the nginx format |
| **A shared proxy caches the feed** | `Cache-Control: private, no-cache, max-age=0, must-revalidate` (§6.4); `private` keeps it out of shared caches while leaving the conditional-GET path usable |
| **The calendar shows occurrences the app has not scheduled** | The RRULE projects at most seven occurrences forward from the current open occurrence (§3.7, §4.3), so the window stays small and rolls forward on completion. Residual divergences: completing late re-anchors the app's next date while the RRULE phase stays put, and `FREQ=MONTHLY`/`FREQ=YEARLY` skip 31st/Feb-29 months where Luxon clamps. Both are documented in the Settings copy (§7.4), and the app is authoritative once an occurrence is reached |
| **The RRULE outlives the app's 365-instance cap** | The 365 cap bounds *materialised rows*, not calendar projection. The projection itself is bounded: `COUNT=7` when there is no `endDate`, and `UNTIL` when there is (§4.3). A rule with `endDate` stops exactly where the user asked, and one without stops after seven projected occurrences |
| **The series UID changes once** | When the 30-day archive purge deletes a completed template, the open instance loses `base_task_id` and its UID becomes its own id (§4.5). One extra delete-plus-create in the subscriber's calendar; acceptable, and the alternative — persisting a separate series id — is a schema change this plan does not need |
| **Deleting a recurring template** | The API deletes its instances in the same transaction (`task-service.ts:824-828`), so nothing is orphaned on the normal path. The `ON DELETE SET NULL` foreign key only matters for the bulk archive purges, where the orphan simply continues the series (§4.5) |
| **Two `due_date` formats** | Every date consumer slices to the date part, parses it as UTC, and validates the shape (§4.4) |
| **Calendar apps cache the feed** | The feed advertises a one-hour refresh (`REFRESH-INTERVAL`, `X-PUBLISHED-TTL`), which Apple and Outlook may honour; Google polls every 12–24 hours regardless. The Settings copy states the per-client delay (§7.4) rather than promising freshness |
| **Users think the feed is broken when Google takes a day** | The Settings section shows `lastChangedAt` and the per-client refresh guidance, and the download button is the immediate path (§7.4). The feed is correct on every fetch; only the arrival time is outside our control. A native push integration would fix it and is out of scope (§10) |
| **Subscriber traffic hits the per-IP rate limit** | The feed route gets its own limit keyed by token hash, not the global per-IP key (§5.1) |
| **`packages/shared` is imported as source by `tsx` but as `dist` in production** | The API's tsconfig maps `@yotara/shared` to source and `tsconfig.build.json` maps it to `dist`; `pnpm build` builds shared first. Noted so a stale `dist` is not mistaken for a bug |

## 10. Out of scope

Deliberately excluded, with the reasoning:

- **Importing `.ics` files.** The date model does not fit: an ICS event has a start *and* an end, an all-day flag, and a timezone, and Yotara has none of them. Import also needs a UID column to avoid duplicating on re-import, and the RRULE → internal-rule mapping is lossy for `BYMONTHDAY` and `BYDAY=2TU`. Estimated at 3–5 days once the serialiser exists.
- **CalDAV.** Serving CalDAV means implementing the server half of RFC 4791 — `PROPFIND`, `REPORT`, multistatus XML, sync tokens, ETags. Two to three weeks, and it is a different product surface.
- **Two-way sync with Google Calendar or Microsoft Graph.** Requires OAuth authorisation-code flows with token refresh (Better Auth currently has no provider configured), a link table, a change cursor on tasks, tombstones so a delete can propagate, a scheduler, and a conflict policy. One and a half to two weeks per provider.
- **Native one-way push to Google Calendar or Microsoft Graph.** The only way to get minutes-level freshness is to write events through the provider's API: OAuth authorisation with token refresh, a task→event link table, a scheduler or write hook, and — for a self-hosted product — Google's OAuth app verification for a sensitive scope, which is a distribution blocker. The ICS feed trades freshness for zero setup and no third-party credentials; §7.4 sets that expectation rather than hiding it.
- **Per-project feed URLs.** Todoist offers a feed per project as well as per account, and Yotara's projects map cleanly onto it. v1 ships one account-wide URL; a project-scoped URL is an additive v1.1 (`WHERE project_id = ?` on the same builder), not a blocker.
- **Per-user timezone storage.** The feed uses floating times, which is correct for a product with no stored timezone. Adding a timezone column would change how every task is written and is a larger decision than this plan.
- **A `VTODO` feed.** Semantically truer, practically unsupported by the target clients (§3.9).
- **Importing CalDAV or Google events as read-only "busy" layers.** A reasonable future feature, but it needs the same OAuth and sync-token work as the full two-way path.

## 11. Open questions for review

1. **Should the download button exist at all, given the subscribe URL?** The download is useful for a one-off import into a local calendar file, and it works on a LAN-only deployment where the subscribe URL does not. It is also a few lines once the serialiser exists. Keeping both is the recommendation.
2. **Should the raw token be re-displayable in Settings?** Storing it in the clear would make the Settings page simpler, at the cost of a credential readable from a database backup. Hashing and a rotate path is the recommendation.
3. **Should completed tasks stay in the feed with `STATUS:CANCELLED`?** That would let a subscriber see what was completed and when, instead of having events vanish. It is also noisier, and with the series model it would need a way to keep the last completed occurrence visible without resurrecting the whole series. Removing them is the recommendation.
4. **Is `TRANSP:TRANSPARENT` right?** It means a task never blocks time on a free/busy view. `OPAQUE` would make tasks more prominent in Google Calendar at the cost of showing the person as busy. `TRANSPARENT` is the recommendation.
5. **Seven projected occurrences, or none?** The plan exports one RRULE from the open occurrence, bounded to seven — matching Todoist's feed. If early users still find that noisy, reduce the count or emit each row as a plain `VEVENT` with no RRULE (one line in the builder, at the cost of seeing only the next occurrence).
6. **Is one hour the right advertised refresh?** It matches Apple's default and Outlook's lower bound; a shorter hint only helps clients that already allow manual refresh and adds poll traffic. One hour is the recommendation.
