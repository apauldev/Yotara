# Plan: Inbound read-only calendar events

**Date:** 2026-11-12
**Status:** Proposed
**Related:**
- `docs/plans/2026-11-09-startup-wizard.md` — the onboarding surface
- `apps/frontend/src/app/features/onboarding/pages/startup-wizard/startup-wizard.component.ts` — the six-step wizard and its draft
- `apps/frontend/src/app/features/personal/pages/calendar-page/calendar-page.component.ts` — the calendar surface
- `apps/frontend/src/app/features/personal/utils/calendar-view.ts` — task-to-day mapping
- `apps/frontend/src/app/core/services/task.service.ts:367-374` — the existing date-range fetch
- `apps/api/src/services/task-service.ts:202-228` — date-range filtering
- `apps/api/src/db/client.ts` — runtime schema bootstrap
- `apps/api/src/lib/email-cleanup.ts:72-96` — the existing periodic-job pattern
- `apps/api/src/lib/timezone.ts` — zone helpers
- `apps/api/src/services/user-service.ts:117-125` — account deletion must cover the new tables

**Scope note:** "inbound read-only" means external calendars come *into* Yotara to be
viewed. Yotara never writes to them. v1 consumes plain **ICS URLs**; OAuth providers,
CalDAV, and two-way sync are deliberately excluded (§14).

---

## 1. Goal

Show a person's real calendar next to their tasks inside Yotara, without pretending the
two are the same thing:

- Add one or more **ICS URLs** (Google's secret calendar address, an Outlook/Microsoft 365
  published calendar, an iCloud public calendar, a Fastmail feed, a team schedule).
- Fetch and parse those feeds on a schedule Yotara controls.
- Show the events in the existing Calendar page as **read-only** items beside tasks, and
  make the two kinds visibly and behaviourally different.
- Give the day its own **agenda view**: an all-day band, a time-ordered lane for timed
  events and timed tasks, and a separate checklist for untimed tasks.
- Offer the connection once during onboarding (optional), so new users discover it without
  turning the six-step wizard into a seven-step one.
- Never write back, never convert an event into a task automatically.

The motivation is simple: a task list says *what to do*, a calendar says *where you must
be*. Planning a day needs both, and today Yotara only knows the first.

## 2. What exists today

### 2.1 The calendar surface

- `apps/frontend/src/app/features/personal/pages/calendar-page/calendar-page.component.ts`
  owns the month grid, week strip, selected-day panel, and the mobile sheet.
- `calendar-view.ts` turns `Task[]` into day buckets: `buildTasksByDay`, `buildMonthCells`,
  `buildWeekDays`, keyed by `task.dueDate.slice(0, 10)`.
- The month grid (`calendar-month-grid.component.ts`) renders task chips with completion
  checkboxes and drag-to-reschedule. The day panel (`calendar-day-panel.component.ts`)
  splits untimed and timed tasks into two lists.
- There is no concept of an item that is not a task: every chip is checkable, draggable,
  and counted.

### 2.2 Data fetching

- The calendar fetches dated tasks with `GET /tasks?dueFrom=&dueTo=&tz=` in two bounded
  windows (`task.service.ts:367-374, 440-524`).
- The API applies inclusive `date(due_date)` bounds (`task-service.ts:203-227`).
- There is no events table, no ICS parser, and no generic external-fetch helper. The only
  third-party HTTP client is the Resend SDK (`apps/api/src/lib/email.ts`).

### 2.3 Storage and background work

- SQLite is bootstrapped at startup by `ensureSqliteSchema` (`db/client.ts:305`) with
  `CREATE TABLE IF NOT EXISTS` blocks plus `ALTER TABLE` guards for added columns.
- The only periodic job is the hourly unverified-account cleanup
  (`email-cleanup.ts:72-96`): `setInterval(...).unref()`, no scheduler framework.
- Account deletion enumerates tables explicitly (`user-service.ts:117-125`); new tables
  must be added there even if they also cascade.

### 2.4 Dependencies

- No ICS library is installed. `ical.js` 2.2.1 is ESM with bundled types and includes
  `RRULE`/`VTIMEZONE`/`RECURRENCE-ID` expansion; `node-ical` 0.27.6 is the alternative.
- Parsing recurrence, timezones, and overrides by hand is not a reasonable option; this
  is the one place where a dependency is justified.

## 3. Product decisions

1. **Events are not tasks.** A separate table, service, API, and UI component. Nothing in
   the task pipeline (`/tasks`, search, counts, filters, completion, projects, labels)
   sees an event.
2. **Read-only inbound.** No writing, editing, deleting, or completing events. No
   drag-to-reschedule of an external event. The source calendar stays authoritative.
3. **ICS URLs only in v1.** No OAuth app, no provider-specific code, no token refresh.
   Any calendar that exposes an ICS URL works.
4. **Yotara controls the fetch.** Inbound freshness is ours: refresh on an interval and
   on demand. That makes it the half that can actually feel live.
5. **A bounded window.** Expand events for roughly one month back to twelve months
   forward, not the whole history. The calendar only draws a six-week grid plus a day.
6. **Multiple named sources.** Each source has a name, colour, enabled flag, and sync
   status. Adding the same URL twice is rejected.
7. **Source URLs are secrets.** A Google secret ICS address is a bearer credential.
   Encrypt at rest, never return it, never log it. Hashing is not enough here because the
   server must recover the URL to fetch it.
8. **Fetching user-supplied URLs is an SSRF surface.** Enforce HTTPS, block private and
   link-local addresses, cap redirects/time/size, and re-validate every hop.
9. **Render together, distinguish clearly.** Events get their own chip, their own source
   colour, and their own section in the agenda; in the month grid they sit in a separate
   band under the task chips. They are never checkable.
10. **Conversion is explicit.** No automatic event → task import. A future "Create task
    from event" action would be a deliberate copy, not a sync.
11. **Failure is visible and non-fatal.** A broken source keeps its last good events and
    shows an error plus a last-synced time. Tasks keep working.
12. **One dependency, for parsing only.** `ical.js` handles the hard parts; the rest is
    ordinary fetch + SQLite.
13. **An agenda day view, not a time grid.** The day gets a chronological agenda: an
    all-day band, a timed lane, and an untimed task checklist. It shows durations and
    order without building overlap columns, drag/resize, or a zoomable grid.
14. **Tasks and events look and behave like different things everywhere.** A task is
    checkable, editable, draggable, and counted. An event is none of those: it carries its
    source calendar's colour and name, opens a read-only detail, and never shows a
    completion control. The UI says "Tasks" and "Events", never a shared "items".

## 4. Tasks vs events: the model, and how the industry handles it

This is the design question the feature turns on. Tasks and events are different
objects with different owners and different affordances, and every mature product keeps
them distinct in the data model even when it shows them in one view.

| | **Task** (Yotara today) | **Calendar event** (new) |
|:---|:---|:---|
| Meaning | Something to do | Something you are committed to at a time |
| Owner | Yotara | The external calendar |
| Time | `due_date` + optional wall-clock `due_time`; no duration, no zone | Start/end instant or all-day range; timezone |
| State | Open / completed / archived; priority; project; labels | `CONFIRMED` / `TENTATIVE` / `CANCELLED`; no completion |
| Actions | Complete, edit, reschedule, delete | View only |
| Recurrence | Materialise-on-complete, one open row at a time | `RRULE` expanded into instances for a window |
| Counts, filters, search | Included | Excluded |

### 4.1 What the established apps do

- **Things 3** shows calendar events alongside to-dos in Today and Upcoming, read-only.
  Events are a separate block, not checkable items.
- **OmniFocus Forecast** interleaves events and tasks in one timeline but keeps them
  visibly distinct. The product framing is explicit: "calendar events tell you where you
  need to be and when, tasks tell you what else you have to accomplish in the time
  between." OmniFocus 2 used separate lists; OmniFocus 3 interleaved them.
- **Sunsama** documents "Tasks vs Events" as a first-class distinction: events alone do
  not count as tasks or towards your workload unless you deliberately import them, and
  timeboxing is the bridge between the two.
- **Google Calendar** keeps Tasks in a separate checkable layer from events; an event has
  guests, a location, and a real time range.
- **Todoist and TickTick** show external events read-only inside the task app; turning a
  task into a calendar block is an explicit action (time-blocking), not an implicit sync.

### 4.2 The rule Yotara should follow

**Two types, one view, different affordances, explicit conversion.**

- A task can be completed; an event cannot. You attend an event; you finish a task.
- An event has a real duration and a timezone; a task has a day and optionally a time.
- An event is owned elsewhere; a task is owned here. Merging them loses the source of
  truth and produces the classic "why did my meeting become a to-do?" bug.
- The bridge is deliberate: a future "Create task from event" copies the title and date;
  a future time-blocking action would create an event from a task. Neither happens
  automatically.

### 4.3 Showing the difference

The model only helps if the interface reflects it. In both the month grid and the day
view:

- Tasks keep the checkbox, the priority/project accent, the editor, and drag.
- Events get the source calendar's colour and name, a calendar glyph, a read-only detail,
  and no completion control.
- Headings say "Tasks" and "Events"; counts are reported separately; a compact legend
  explains the two glyphs.

The detailed treatment is in §10.4. The point is that a person should be able to tell
from across the room which row they can tick off and which one they cannot.

## 5. How it works

1. **Add a source.** Settings → Calendars → *Add calendar*: paste the ICS URL, give it a
   name and colour. The API validates the URL, fetches it once, parses it, and stores the
   events. A bad URL, a private address, or a feed with no `VEVENT`s is rejected with a
   clear message.
2. **Yotara refreshes it.** A periodic job re-fetches each enabled source (default every
   15 minutes) with conditional GET, re-expands recurrence for the window, and replaces
   that source's stored instances. A *Refresh now* action runs the same path immediately.
3. **The calendar page asks for a range.** `GET /calendar/events?from=&to=&tz=` returns the
   events overlapping the visible window in the reader's zone, alongside the existing task
   request.
4. **The page renders both, differently.** Month cells get task chips and, below them,
   event chips (source colour, calendar glyph, no checkbox, no drag). The day becomes an
   **agenda**: an all-day band, a timed lane, and an untimed task checklist. Events open a
   read-only detail; tasks open the editor and can be completed.
5. **Nothing flows back.** There is no write route. Removing a source deletes its events;
   disabling it hides them but keeps the configuration.
6. **Failures stay put.** If a fetch fails, the last good events remain and Settings shows
   *"Last synced 2 hours ago — error: 404"*. The rest of the app is unaffected.

## 6. Data model

Two new tables, bootstrapped the same way as the existing ones.

### 6.1 `calendar_sources`

| Column | Type | Notes |
|:---|:---|:---|
| `id` | TEXT PK | `randomUUID()` |
| `user_id` | TEXT NOT NULL | FK `user(id)` ON DELETE CASCADE |
| `name` | TEXT NOT NULL | User-supplied label |
| `url_ciphertext` | TEXT NOT NULL | Encrypted ICS URL; never returned or logged |
| `url_hash` | TEXT NOT NULL | SHA-256 of the URL, for duplicate detection |
| `color` | TEXT NOT NULL | One of the existing `ProjectColor` values or a source palette |
| `enabled` | INTEGER NOT NULL DEFAULT 1 | Disabled sources are skipped |
| `etag` | TEXT | Last `ETag`, for conditional GET |
| `last_modified` | TEXT | Last `Last-Modified` |
| `last_fetched_at` | TEXT | UTC ISO |
| `last_success_at` | TEXT | UTC ISO |
| `last_error` | TEXT | Human-readable, never contains the URL |
| `next_attempt_at` | TEXT | Backoff state |
| `created_at`, `updated_at` | TEXT NOT NULL | |

Indexes: `UNIQUE(user_id, url_hash)`, `INDEX(user_id, enabled)`.

### 6.2 `calendar_events`

| Column | Type | Notes |
|:---|:---|:---|
| `id` | TEXT PK | Deterministic: `sha256(source_id \| uid \| recurrence_id)` |
| `source_id` | TEXT NOT NULL | FK `calendar_sources(id)` ON DELETE CASCADE |
| `user_id` | TEXT NOT NULL | Denormalised for fast range queries; FK `user(id)` CASCADE |
| `uid` | TEXT NOT NULL | ICS `UID` |
| `recurrence_id` | TEXT NOT NULL DEFAULT '' | Instance override key; `''` (never `NULL`) for the master event |
| `summary` | TEXT NOT NULL DEFAULT '' | |
| `description` | TEXT | Plain text; rendered as text, never HTML |
| `location` | TEXT | |
| `start_at` | TEXT NOT NULL | UTC ISO instant (all-day = UTC midnight of `start_date`; floating = the wall clock read as UTC, §6.3) |
| `end_at` | TEXT NOT NULL | UTC ISO instant, exclusive (all-day = UTC midnight of `end_date`) |
| `all_day` | INTEGER NOT NULL DEFAULT 0 | |
| `start_date` | TEXT | `YYYY-MM-DD` for all-day display. Not used for day bucketing (§6.3) |
| `end_date` | TEXT | `YYYY-MM-DD`, exclusive for all-day. Not used for day bucketing (§6.3) |
| `timezone` | TEXT | IANA zone from `TZID`, when known |
| `floating` | INTEGER NOT NULL DEFAULT 0 | No `TZID` and no `Z`; the stored wall clock is the source's own (§6.3) |
| `status` | TEXT | `CONFIRMED` / `TENTATIVE` / `CANCELLED` |
| `updated_at` | TEXT NOT NULL | |

Indexes: `UNIQUE(source_id, uid, recurrence_id)`, `INDEX(user_id, start_at, end_at)`,
`INDEX(source_id)`.

**`recurrence_id` is `''`, never `NULL`.** SQLite treats `NULL`s as distinct inside a
UNIQUE index, so a nullable column would let a non-recurring event be inserted twice
without tripping the constraint. The empty string is the sentinel for "the master event",
which makes `UNIQUE(source_id, uid, recurrence_id)` behave as written.

**The deterministic id is hashed with separators.** `sha256(`${source_id}|${uid}|${recurrence_id}`)`
rather than a bare concatenation: without a delimiter, `source = "ab"` + `uid = "c"` and
`source = "a"` + `uid = "bc"` hash the same string. SHA-256 matches `url_hash` in
§6.1, so the feature does not carry two hash families.

### 6.3 Day bucketing and the reader's zone

Which day an event belongs to is a property of the **reader's** zone, not the source's.
The month grid shows one month and the agenda shows one day, so the plan needs one
unambiguous answer to "which day is this event on" — and the server must be the one to
give it, because the client and the server must not disagree about where a chip sits.

**The server owns bucketing.** `GET /calendar/events` takes the reader's zone as `tz`
(§8) and returns, per event, the reader-local `dayKeys` it occupies plus the
reader-local `startTime`/`endTime` to render. The client groups by `dayKeys` and does no
timezone arithmetic of its own.

**Two kinds of event, two storage rules:**

| Case | `start_at` / `end_at` | `floating` | Display |
|:---|:---|:---|:---|
| `TZID` present, or the value ends in `Z` | the true UTC instant | `0` | the instant, projected into the reader's zone |
| Neither `TZID` nor `Z` | the wall clock **read as UTC** — a deterministic placeholder | `1` | the placeholder's UTC date and time parts, unchanged |

The floating rule is the interesting one. A floating event has no absolute instant: its
`09:00` means whatever wall-clock time the reader's calendar shows. Storing it as
`2026-11-13T09:00:00Z` makes the stored value deterministic and sortable, and because the
placeholder's UTC parts *are* the source's wall clock, the display reads them off
directly and never re-offsets them into the reader's zone. Re-projecting a floating event
through the reader's zone would shift a 09:00 standup to 22:00 for anyone east of UTC.

**`start_date` and `end_date` are all-day display fields only.** They are not the bucketing
key for timed or floating events, because those depend on the reader's zone.

**A multi-day event occupies every day it spans.** A conference from Nov 12 09:00 to
Nov 15 17:00 covers four days, and a single `dayKey` would put it on Nov 12 only — which
would silently drop it from the Nov 14 agenda. The response therefore carries `dayKeys`
(a one-element array for an ordinary event), and the month grid draws a chip on each
spanned day, the way Google Calendar does.

### 6.4 Why expand at ingest

Store concrete instances for the window rather than masters plus rules:

- The calendar's range query stays a plain `start_at/end_at` overlap, mirroring the task
  query's shape — though on instants in the reader's zone rather than on wall-clock dates
  (§8).
- `RRULE`, `RDATE`, `EXDATE`, `RECURRENCE-ID`, and `VTIMEZONE` are handled once, on the
  server, by the parser.
- Re-expanding a bounded window on each refresh is cheap and makes cancelled or edited
  occurrences disappear correctly.
- The raw feed is not stored by default (size and privacy); a refresh re-fetches it.

Window: `today - 31 days` to `today + 366 days`, configurable. Browsing beyond the window
shows a "events beyond this range aren't loaded" note rather than silently pretending
there are none.

### 6.5 Refresh semantics

For each source, on every successful fetch:

1. Parse the feed and expand instances overlapping the window.
2. Normalise each instance to the row shape above.
3. In one transaction, upsert the new set for `(source_id, window)` and delete rows for
   that source inside the window that are no longer present. Rows outside the window are
   left alone.
4. Update `last_fetched_at`, `last_success_at`, `etag`, `last_modified`, and clear
   `last_error`.

Cancelled events (`STATUS:CANCELLED`) are skipped and therefore removed by the replace.
Events that disappear from the feed are removed the same way.

## 7. Ingest: fetch, parse, normalise

### 7.1 Fetching

- HTTPS only by default. An `ALLOW_INSECURE_CALENDAR_URLS=true` escape hatch can permit
  `http://` for LAN/self-hosted feeds, documented as a trust decision.
- `AbortSignal.timeout(10_000)`; 5 MB response cap; at most 3 redirects, each re-validated.
- Conditional GET with `If-None-Match` / `If-Modified-Since`; a `304` is a success and only
  updates `last_fetched_at`.
- A `User-Agent` identifying Yotara, so providers can see who is fetching.
- No cookies, no auth headers, no credentials.

### 7.2 Parsing with `ical.js`

- Parse `VCALENDAR` → `VEVENT` only. `VTODO`/`VJOURNAL` are ignored in v1 (a future
  import path, §14).
- `DTSTART`/`DTEND`:
  - `VALUE=DATE` → all-day; `DTEND` is exclusive.
  - DATE-TIME with `TZID` → resolve the zone and store a UTC instant and the zone.
  - DATE-TIME ending in `Z` → UTC.
  - Floating DATE-TIME → store the wall clock **read as UTC** with `floating = 1`. The
    placeholder's UTC date and time parts are the source's own wall clock, which is how
    calendar clients treat a time with no zone; it is never re-projected into the
    reader's zone, which would shift a 09:00 standup to 22:00 east of UTC (§6.3).
  - A `TZID` the server does not know → treat as floating. The wall clock the feed
    intended is still the right local time to show, so the event is kept rather than
    dropped; `timezone` is left null.
  - `DURATION` instead of `DTEND` → compute the end.
- Recurrence:
  - **Expand in wall-clock space, and turn only the finished occurrence into an
    instant.** A meeting at 09:00 New York stays at 09:00 local across a DST
    boundary, which is what a reader expects; expanding in instant space would slide
    it to 08:00 or 10:00 once the clocks move.
  - Expand with `ICAL.Recur` and `ICAL.RecurIterator` over a *floating* base time, rather
    than `ICAL.Event`'s iterator. `ical.js` resolves `DTSTART` through its own timezone
    registry, which loses the `TZID` parameter for any zone it does not know — so the
    raw jCal value is read directly and the zone resolved separately.
  - Honour `RRULE`, `RDATE`, `EXDATE`, and `RECURRENCE-ID` overrides.
  - Skip instances with `STATUS:CANCELLED`.
- Text: `ical.js` unfolds lines and unescapes `\n`, `\,`, `\;`, `\\`. Store the unescaped
  text, reduced to plain text — feeds exported from mail clients wrap descriptions in
  markup, and the value is never rendered as HTML.
- Identity: `UID`; if missing, hash `summary + start` so a malformed feed does not create
  unstable rows. The instance key is `recurrence_id`: `''` for a standalone event, and the
  resolved start instant for each instance of a recurring one (§6.2). An override takes
  over the key of the instance it replaces, so the row keeps the same identity across
  refreshes.
- Limits: skip a malformed `VEVENT` rather than failing the source; count skips and surface
  them in the sync result.
- Cap the number of expanded instances per source (e.g. 10,000) to bound memory and rows,
  and cap the recurrence steps examined for one event so a hostile rule cannot spin.

### 7.3 What is not extracted in v1

- Attendees, organiser, attachments, alarms/reminders, and conferencing links. They add
  privacy surface and size for little planning value. `location` and `description` are
  enough to be useful.

## 8. API design

All routes require a session (`requireAuthenticatedUser`) and are scoped to
`request.userId`.

| Method | Route | Purpose |
|:---|:---|:---|
| `GET` | `/calendar/sources` | List sources: id, name, colour, enabled, lastFetchedAt, lastSuccessAt, lastError, eventCount. The URL is never returned |
| `POST` | `/calendar/sources` | `{ url, name?, color? }`. Validate, fetch once, parse, store, save. `422` on an unusable URL/feed |
| `PATCH` | `/calendar/sources/:id` | `{ name?, color?, enabled? }` |
| `DELETE` | `/calendar/sources/:id` | Delete the source and cascade its events |
| `POST` | `/calendar/sources/:id/refresh` | Fetch and replace now; returns the same sync status shape |
| `GET` | `/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<IANA>` | Events overlapping the inclusive range **in the reader's zone**, ordered by `start_at`, with `sourceName`, `sourceColor`, and the reader-local `dayKeys`/`startTime`/`endTime` joined in (§6.3) |

- Validate `from`/`to` with the existing `assertCalendarDate` discipline; an inverted range
  returns an empty list rather than an error.
- **`tz` is the reader's IANA zone**, resolved with `resolveTimezone` and defaulting to
  UTC. `from`/`to` are **dates**, while `start_at`/`end_at` are **instants**, so the range
  is converted to a half-open instant range in that zone before the query runs:
  `[startOfDayInUtc(from, tz), startOfNextDayInUtc(to, tz))`. The upper bound is the start
  of the *next* day rather than the last instant of the given day, so a 23- or 25-hour DST
  day is covered exactly. The SQL predicate is a strict instant overlap
  (`start_at < rangeEnd AND end_at > rangeStart`), so an event ending exactly at midnight
  is not counted in both days.
  The existing task range filter needs no zone because `due_date` holds a wall-clock date;
  an instant-based column does not.
- `assertCalendarDate` moves out of `task-service.ts` into
  `apps/api/src/lib/calendar-date.ts` so the task and event services share it. A
  service-private helper must not be imported across a service boundary, and the rule is
  identical for both.
- The event payload carries the reader-local projection, so the client groups by `dayKeys`
  and never does timezone arithmetic itself:

  ```ts
  export interface CalendarEventDto {
    id: string;
    sourceId: string;
    sourceName: string;
    sourceColor: string;
    summary: string;
    description: string | null;
    location: string | null;
    allDay: boolean;
    /** Reader-local days this event occupies. One entry for an ordinary event. */
    dayKeys: string[];
    /** Reader-local start time (HH:mm). Null for all-day events. */
    startTime: string | null;
    /** Reader-local end time (HH:mm). Null for all-day events. */
    endTime: string | null;
    /** True when the feed gave no zone: the times are the source's own wall clock. */
    floating: boolean;
    /** The source's declared IANA zone, when it had one. */
    timezone: string | null;
    status: string | null;
  }
  ```
- Cap the range (e.g. 400 days) and the response (the window already bounds it).
- Rate-limit source creation and manual refresh (e.g. 10/minute per user) through the
  existing `@fastify/rate-limit` route config.
- OpenAPI schemas for all six routes; `pnpm docs:check` enforces the spec.

## 9. Refresh and freshness

Inbound is the direction Yotara controls, so this is where the product can feel alive.

- **Default interval: 15 minutes per source**, computed from `last_fetched_at`, plus
  jitter, so sources do not refresh in lockstep.
- **Conditional GET**: most polls return `304` and cost almost nothing.
- **Backoff**: on failure, `next_attempt_at` moves 15m → 1h → 6h → 24h (cap), and resets on
  success. `last_error` is shown in Settings.
- **Manual refresh**: the Settings row's *Refresh now* calls the same service; the UI shows
  a spinner and the resulting event count.
- **Job shape**: mirror `email-cleanup.ts` — a module-level `setInterval(...).unref()`
  started in `startServer`, with a concurrency cap (e.g. 3) and a boot delay so a restart
  does not stampede every source.
- **No blocking of request handlers**: the only synchronous path is *Add calendar* /
  *Refresh now*, which is bounded by the fetch timeout and size cap.

Because Yotara chooses this cadence, inbound events can be minutes old rather than waiting
on a calendar vendor's fetch schedule.

## 10. Frontend

### 10.1 Settings → Calendars

A new section after Export (`settings-page.component.ts:332`):

- List of sources: colour dot, name, "Last synced 12 minutes ago", error badge, enabled
  toggle, Refresh, Remove.
- *Add calendar* form: URL, name, colour, plus short provider help (Google's secret address
  in *Settings → Calendars → Integrate calendar*; Outlook's published calendar; iCloud's
  public calendar).
- Copy makes the read-only and privacy trade-off explicit: the URL is a secret, Yotara
  stores it encrypted, and events are shown read-only.
- A one-time explainer on first connect: **"Events come from your calendar and are
  read-only. Tasks are yours to complete."** This is the sentence that sets the mental
  model; everything else in the UI reinforces it.
- Empty state: "No calendars connected. Tasks and events will appear together here."

### 10.2 Month grid

The month remains the planning view. Each cell draws two kinds of entry, never one
undifferentiated list:

- **Task chips first**, with the existing checkbox, priority bar, and drag behaviour.
- **Event chips below them**, with a calendar glyph, the source colour, and the start
  time; no checkbox, no drag handle. They are visually lighter and clearly not
  completable.
- A cell with only events shows an event count, not a task count. The accessible label
  names both kinds — "N tasks, M events" — and omits the events count when there are
  none, so `dayAriaLabel` is updated accordingly.
- `+N more` opens the day view with the full list. The label names the kind, because
  "+N more" is ambiguous once tasks and events share a cell.
- `CalendarCell` gains `events: CalendarEvent[]`. `buildMonthCells` and `buildWeekDays`
  stay task-based; the page merges events in, so the existing task bucketing logic is
  untouched.

**One row budget per cell, shared by both kinds.** The grid is a fixed 42-cell layout
whose rows size to their tallest cell, so an uncapped cell makes its week taller than
the others and the month goes ragged. Tasks and events therefore draw from a single
budget of three rows (`planCellChips` in `calendar-view.ts`): tasks claim their slots
first, events take what is left, and a cell with no tasks gives the whole budget to
events.

| Cell contains | Rendered | Overflow |
|:---|:---|:---|
| 5 tasks, 0 events | 3 task chips | "+2 more" *(unchanged from today)* |
| 5 tasks, 1 event | 2 task chips + 1 event chip | "+3 more tasks" |
| 5 tasks, 3 events | 1 task chip + 2 event chips | "+4 more tasks", "+1 more event" |
| 0 tasks, 5 events | 3 event chips | "+2 more events" |

Rows never exceed three, so cell height is unchanged from today.

**The overflow is kind-aware.** "+N more" is ambiguous once two kinds share a cell, so
the label names the kind: "+3 more tasks", "+2 more events". Both open the day view.

**The accessible label names both kinds**, and omits events when there are none — "0
events" would claim the calendar is clear even when events have simply not loaded yet:

```
Friday, October 2, 2026, 1 task, 2 events, today
```

**A multi-day event draws a chip on every day it spans** (§6.3), the way Google Calendar
does. The chip shows the event's own start time on each day, so a three-day conference
reads as "09:00 · Conference" on all three.

**If the task slots feel too scarce**, the alternative is a single compact event band
(`● 2 events · 09:00 Standup`) instead of one row per event, which preserves all three
task slots. The budget approach is the recommendation; the band can follow if the grid
feels cramped in practice.

### 10.3 Agenda day view

The day view is the execution view: what the day actually looks like, in order. It is an
**agenda**, not a time grid.

- **Placement.** On desktop, the right column becomes the agenda day view (replacing the
  task-only day panel). On mobile, tapping a day opens it full-screen (replacing the
  bottom sheet). No new route is needed.
- **Structure**, top to bottom:
  1. **All-day band** — all-day events for that date.
  2. **Timed lane** — a time gutter with hourly labels. Events render as rows aligned to
     their start (`09:00–09:30 · Standup · Work`). Timed tasks render as rows at their due
     time with a task chip and checkbox, and **no implied duration**. A subtle "now" line
     marks the current time.
  3. **Tasks lane** — untimed tasks due that day, as a checklist. They have no time, so
     they do not sit on the time axis.
- Overlapping events stack as consecutive rows. Side-by-side overlap columns, drag,
  resize, and zoom are explicitly not part of this view (§14).
- A multi-day event appears on every day it spans (§6.3): the row shows the event's own
  start time on the first day and the portion that falls on the day thereafter, so a
  Wednesday-to-Friday conference reads correctly on the Thursday.
- A floating event shows the source's own wall clock, unchanged by the reader's zone
  (§6.3).
- Events open the read-only detail; tasks open the editor and can be completed. Nothing
  in the day view changes an event.
- Empty states are separate: "No events — your calendar is clear" and "No tasks due."
- Accessibility: the time gutter is a list, not a table; each row's label names the kind
  ("Event: Standup, 9 to 9:30, from Work calendar" / "Task: Send invoice, due 14:00").
- A full-width "Day" toggle can reuse the same component later; v1 ships the
  panel/sheet placement so there is no new route or navigation mode to learn.

### 10.4 Telling tasks and events apart

This is a product requirement, not styling polish. The two things are managed
differently, so they must read differently at a glance:

| | **Task** | **Event** |
|:---|:---|:---|
| Primary control | Checkbox | None |
| Chip | Priority bar, task glyph, checkbox | Source-coloured bar, calendar glyph |
| Hover / click | Complete, open editor | Open read-only detail |
| Drag | Reschedule | Never |
| Metadata | Project, labels, priority | Source calendar, location |
| Recurrence | Task recurrence badge | None; the source owns it |
| Counts | Included in task counts | Excluded |
| Section heading | "Tasks" | "Events" |

Copy rules:

- Use **"Tasks"** and **"Events"** as the only nouns. Avoid "items", and avoid
  "scheduled" where it could mean either.
- The event detail ends with a provenance line: *"From Work calendar · Read-only. Edit
  this event in Google Calendar."*
- The task editor never appears for an event, and the event detail never offers a
  complete, edit, or delete action.
- A compact legend in the calendar header shows the two glyphs and the source dots. The
  fuller explainer lives in Settings (§10.1) and is shown once on first connect.
- Do not colour events with a project or priority colour, and do not colour tasks with a
  source colour. Colour is the fastest signal that these are different.
- Do not render a single unlabeled stream where a checkbox sometimes appears and
  sometimes does not.

### 10.5 What the page must not do

- Do not count events in task counts, "No date" counts, or the month's task summary.
- Do not include events in search, filters, projects, labels, or notifications.
- Do not open the task editor for an event.
- Do not write an event's date back to the source.
- Do not let an event inherit task behaviours: no completion, no drag, no priority, no
  project or label assignment.
- Do not let a task inherit event chrome: no source calendar name, no "read-only" badge.

### 10.6 Onboarding: an optional connect card

The wizard already has six steps (`WIZARD_STEPS` in `startup-wizard.component.ts`).
Calendar connection is optional and often requires the person to leave Yotara to copy a
URL, so it should **not** become a seventh blocking step. Put it on the **Ready** step as
a card, with the form in a dialog:

- **Card copy.** *"See your calendar next to your tasks (optional)."* Then one sentence:
  "Connect a calendar and its events appear read-only beside your tasks. You can do this
  later in Settings → Calendars." A **Connect a calendar** button opens the dialog.
- **Dialog.** Reuses the same `calendar-source-form` as Settings (§10.1): URL, name,
  colour, and a provider-help disclosure. The form calls `POST /calendar/sources`
  immediately; success shows *"Connected — 24 events found"* and closes; failure shows
  the server's message inline and leaves the wizard untouched.
- **Provider help** (basic; exact labels vary by provider version):
  - **Google Calendar:** Settings → Calendars → select the calendar → *Integrate
    calendar* → copy the **Secret address in iCal format**. Workspace admins can block
    external calendar subscriptions; if the company account refuses, use a personal
    account or ask the admin.
  - **Outlook / Microsoft 365:** Settings → Calendar → *Shared calendars* → *Publish a
    calendar* → select the calendar → copy the ICS link. Tenant policy can disable
    publishing.
  - **Apple iCloud:** Calendar → select the calendar → *Share Calendar* → *Public
    Calendar* → copy the link. Change `webcal://` to `https://` when pasting.
  - **Anything else:** any URL that returns `text/calendar`.
- **Skip is first-class.** *"I'll do this later"* closes the dialog and writes nothing.
  The Ready summary shows **Calendar: Not connected** with the same Connect action, and
  Settings remains the permanent home.
- **Connected state.** After a successful connect, the Ready summary shows *"Calendar:
  Work · 24 events"* and a *Manage in Settings* link. A *Disconnect* shortcut is optional.
  The summary is rendered from the sources re-fetched when the step opens, so it stays
  correct even if the source was added, removed, or rotated elsewhere.
- **Never put the URL in the wizard draft.** `startup-wizard.component.ts` persists its
  draft to `localStorage['yotara_wizard_draft:<userId>']`; an ICS URL is a secret and must
  not be written there. Keep it in the form's in-memory signal and send it to the server.
  **Re-fetch the sources when the Ready step opens** rather than adding a
  `calendarConnected` flag to the draft: `readDraft()` gates on
  `version === WIZARD_DRAFT_VERSION`, so adding a field would mean bumping the version,
  and a version bump *silently discards* an in-progress wizard — the code removes the
  stored draft and only surfaces a message for an expiry, not for a version change.
  Re-fetching needs no draft change at all.
- **Completion is independent.** `completeOnboarding()` does not wait on the calendar, and
  a failed connect never blocks **Enter Yotara**. If the person connects and then abandons
  the wizard, the source remains and is manageable in Settings.
- **Accessibility.** The dialog traps focus, closes on Escape, and returns focus to the
  card button. The card is a normal button in the Ready step's tab order.

If product later wants it more prominent, it can become a step between Starter and Tips.
The Ready-step card is the recommendation because it does not extend the wizard or force a
context switch mid-onboarding.

## 11. Security and privacy

### 11.1 The source URL is a credential

A Google secret ICS URL grants read access to that calendar. Therefore:

- Encrypt `url_ciphertext` at rest with a dedicated `CALENDAR_ENCRYPTION_KEY`, falling back
  to a key derived from `BETTER_AUTH_SECRET` via HKDF when the dedicated key is absent.
  Document that rotating the underlying secret makes stored URLs undecryptable, and the
  user must re-add the source.
- Never return the URL from any endpoint. Show the host and a label only.
- Never log the URL. It arrives in a POST body, and Fastify's default logger records
  request URLs; error handlers must redact the body and never log the URL.
- Never include the URL in `last_error`; map failures to short, safe messages.

### 11.2 SSRF

The server fetches a URL the user supplies. Mitigations:

- Scheme allowlist (`https:`, plus the explicit insecure opt-in).
- Reject credentials embedded in the URL — the URL is already a secret, and a second one
  inside it would travel in the request line and in every proxy log along the way.
- Reject `localhost`, loopback, link-local, private RFC1918, IPv6 ULA/link-local, and
  cloud metadata addresses after DNS resolution. The check covers addresses tunnelled
  inside IPv6 ones (IPv4-mapped, NAT64, 6to4), so `::ffff:169.254.169.254` is refused too.
- **Pin the connection to the addresses that were validated.** The request is made with a
  custom `lookup` that only ever returns the already-checked addresses, so a DNS record
  that changes between the check and the connect cannot smuggle the request onto a
  private address. This closes the rebinding gap that the residual risk below describes.
- Re-validate every redirect hop from scratch; cap redirects at 3.
- Cap response size (5 MB) and time (10 s); require a `text/calendar`-ish content type or
  a body starting with `BEGIN:VCALENDAR`.
- Do not forward any request headers or cookies.

### 11.3 Data handling

- Every query filters by `user_id`; sources and events cascade on user delete.
- Add both tables to `deleteAccountForUser` (`user-service.ts:117-125`) even though the
  FKs cascade, matching the explicit convention there.
- Event descriptions are rendered as plain text (no `marked`, no HTML), because they are
  untrusted third-party content.
- Rate-limit source creation and manual refresh.
- Do not store attendees in v1; they are the most sensitive and least useful field.

## 12. Work breakdown

Three reviewable pull requests, each green on its own.

| Part | Result | Depends on |
|:---|:---|:---|
| **1. Ingest core** | Schema, encrypted source storage, SSRF-guarded fetch, parse/expand/normalise, zone projection, unit tests. No routes, no UI | — |
| **2. API + refresh** | Source and event routes, the refresh job, the route schemas, route tests | 1 |
| **3. Calendar surface + onboarding** | Settings sources section, events layer in the month grid, the agenda day view, detail view, the optional Ready-step connect card, e2e | 2 |

Part 1 is the risky one: recurrence expansion, timezones, and SSRF belong there and should
be reviewed closely. The SSRF guard is part of Part 1 rather than Part 2, because it
lives in `calendar-fetch.ts` alongside the fetch it protects — a guard separated from the
request it governs is a guard that drifts.

### 12.1 Part 1 — Ingest core

Everything that turns a URL into rows. No routes, no UI, but the schema change is already
in place — inert until Part 2 reads it.

1. **Schema.** `calendar_sources` and `calendar_events` in `db/schema.ts`, plus their
   `CREATE TABLE` blocks and indexes in the `SQLITE_BOOTSTRAP_SQL` template literal at
   `db/client.ts:12` (§6.1, §6.2). The bootstrap is one string, so the tables and the
   indexes go there together. No migration file.
2. **Encryption.** `lib/calendar-encryption.ts`: derive the key from
   `CALENDAR_ENCRYPTION_KEY`, falling back to HKDF over `BETTER_AUTH_SECRET`;
   `encryptUrl`/`decryptUrl`; `hashUrl` (SHA-256) for duplicate detection. A key must
   exist before a source can be written, so the fallback is what keeps a self-hoster who
   set only `BETTER_AUTH_SECRET` working.
3. **The date rule.** Extract `assertCalendarDate` out of `task-service.ts` into
   `lib/calendar-date.ts` and have `task-service.ts` import it. A pure refactor with no
   behaviour change — but the event service must not import a helper from another
   service.
4. **Zone helpers.** `startOfNextDayInUtc` and `calendarRangeToInstants` in
   `lib/timezone.ts` (§8). Pure.
5. **Fetch.** `lib/calendar-fetch.ts`: HTTPS allowlist, DNS resolution with loopback,
   private, link-local, and metadata addresses rejected, redirect re-validation at every
   hop (max 3), 10 s timeout, 5 MB cap, conditional GET, no cookies and no auth headers
   (§7.1, §11.2). The connection is pinned to the validated addresses, so a DNS record
   that changes after the check cannot redirect the request onto a private address.
6. **Parse and expand.** `lib/calendar-parse.ts`: `ical.js` parse, `VCALENDAR` → `VEVENT`
   only, the all-day / `TZID` / UTC / floating / `DURATION` cases, `RRULE`, `RDATE`,
   `EXDATE` and `RECURRENCE-ID` expansion inside the window, a per-`VEVENT` skip rather
   than a whole-source failure, and the instance cap (§7.2).
7. **Zone projection.** `lib/calendar-local.ts`: project a stored event onto the reader's
   zone — `dayKeys`, `startTime`, `endTime` (§6.3).

**Tests**

| File | Covers |
|:---|:---|
| `calendar-fetch.test.ts` | Loopback, `127.0.0.1`, `::1`, `169.254.169.254`, RFC1918, private IPv6, a host that resolves to a private address, a redirect to a private host, the size cap, the time cap, `304` handling |
| `calendar-parse.test.ts` | All-day, `TZID`, UTC, floating, `DURATION`, `RRULE`, `EXDATE`, `RECURRENCE-ID`, a malformed `VEVENT` skipped, a missing `UID`, the instance cap |
| `calendar-local.test.ts` | Absolute, floating, all-day, multi-day, and DST boundaries — a 23-hour and a 25-hour day — at UTC+13 and UTC-11 |
| `calendar-encryption.test.ts` | Round trip, the `BETTER_AUTH_SECRET` fallback, a wrong key failing closed, the URL never reaching a log line |
| `db/calendar-schema.test.ts` | The bootstrap creates both tables; `recurrence_id` is `NOT NULL DEFAULT ''`; the uniqueness indexes behave; the cascades fire |

**Notes**

- The API is ESM (`"type": "module"`, `module: NodeNext`) and `ical.js` 2.2.1 ships ESM
  with bundled types, so there is no CommonJS interop to work around. It is the only new
  runtime dependency in the feature.
- `ical.js` resolves `DTSTART` through its own timezone registry and **loses the `TZID`
  parameter** for any zone it does not know, silently degrading it to a floating time.
  The parser therefore reads the raw jCal value and resolves the zone separately, and
  expands recurrences in wall-clock space (§7.2).
- The fetch module exposes one test seam, `resolveHost`, which replaces DNS resolution.
  The guard refuses loopback addresses, so the transport cannot be exercised end to end
  against a local test server without it. Production code never sets it, and every other
  host — including a redirect target — still goes through the real policy.
- `CALENDAR_ENCRYPTION_KEY` and `ALLOW_INSECURE_CALENDAR_URLS` land in
  `apps/api/.env.example` and `docs/CONFIGURATION.md` here, not in Part 2 — the CI
  `docs-consistency` job requires every variable in `.env.example` to be documented in
  `CONFIGURATION.md`, so the two files have to move together. `DOCKER.md` gets them in the
  same change.

**Exit criteria:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`,
`pnpm docs:check` green. No route or UI change.

### 12.2 Part 2 — API and refresh

The six routes, and the job that keeps them fresh.

1. **Source service.** `services/calendar-source-service.ts`: create (validate the URL,
   fetch once, parse, store), list, patch, delete, duplicate detection against
   `UNIQUE(user_id, url_hash)`, and an ownership check on every read and write. The URL is
   never returned — the API exposes the host and a label only (§11.1).
2. **Event service.** `services/calendar-event-service.ts`: the zone-aware range query
   (§8) and the replace-on-refresh transaction (§6.5). Upsert the new set, delete the rows
   for that source inside the window that are no longer present, leave the rows outside
   the window alone — all in one transaction.
3. **Refresh job.** `lib/calendar-refresh.ts`: due-source selection from
   `last_fetched_at` plus jitter, a 15-minute default, backoff 15m → 1h → 6h → 24h, a
   concurrency cap of 3, and a boot delay so a restart does not stampede every source.
   Shaped like `email-cleanup.ts`: a module-level `setInterval(...).unref()` started from
   `startServer`.
4. **Routes.** `routes/calendar.ts`: the six routes, each behind `requireAuthenticatedUser`
   and scoped to `request.userId`. Source creation and manual refresh are rate-limited
   through the existing `@fastify/rate-limit` route config.
5. **Schemas.** `docs/openapi.ts` for all six routes; `pnpm docs:check` enforces the spec.
6. **Cleanup.** `services/user-service.ts`: delete both new tables on account deletion,
   matching the explicit enumeration there even though the foreign keys cascade.

**Tests**

| File | Covers |
|:---|:---|
| `calendar-event-service.test.ts` | Replace semantics, cancellations, window bounds, the zone-aware range, the strict overlap predicate |
| `routes/calendar.test.ts` | Auth, ownership (another user's source id is a 404), validation, the event payload shape, and the URL never appearing in a response |
| `calendar-refresh.test.ts` | Due-source selection, backoff progression, a failing source keeping its last good events |

**Exit criteria:** the suite is green; `GET /calendar/events` returns the reader-local
projection; a source added by hand appears after a refresh.

### 12.3 Part 3 — Calendar surface and onboarding

Events visible, and unmistakably not tasks.

1. **Client.** `core/services/calendar.service.ts`: sources and events, sending `tz`
   from `getUserTimezone()` (§8).
2. **View model.** `utils/calendar-view.ts`: `buildEventsByDay` keyed by the server's
   `dayKeys`, `buildDayAgenda`, `planCellChips` for the shared three-row budget (§10.2),
   and `CalendarCell.events`.
3. **Event chrome.** `components/calendar-event-chip/` — calendar glyph, source colour,
   start time, no checkbox, no drag. `components/calendar-event-detail/` — the read-only
   detail, ending with the provenance line *"From Work calendar · Read-only. Edit this
   event in Google Calendar."*
4. **Month grid.** `components/calendar-month-grid/`: task chips first, event chips
   below, the kind-aware overflow, and the aria label naming both kinds. Drag stays
   task-only.
5. **Agenda day view.** `components/calendar-day-view/`: the all-day band, the timed lane
   with a time gutter and a "now" line, and the untimed task checklist. It replaces
   `calendar-day-panel` in the desktop right column and in the mobile sheet.
6. **Page wiring.** `pages/calendar-page/`: fetch the event range alongside the existing
   task request, separate the task and event bands, and add the header legend.
7. **Settings.** `pages/settings-page.component.ts`: a Calendars section after Export,
   reusing `components/calendar-source-form/` with the provider help, the "Last synced"
   line, the error badge, and the first-connect explainer.
8. **Onboarding.** `onboarding/startup-wizard/`: the Ready-step card and its dialog,
   reusing the same form. The URL stays in memory; the Ready step re-fetches the sources
   for its summary, so the wizard draft is never touched (§10.6).
9. **Today page.** `pages/task-list-page/`: fetch today's event range and show an
   event-only **Today's schedule** panel beside the task list on wide screens. On
   smaller screens, stack the schedule above Due Today. Keep overdue tasks above both,
   preserve task counts and completion progress, and open events in the read-only detail.
10. **Retire** `components/calendar-day-panel/` once the agenda has landed.

**Tests**

| File | Covers |
|:---|:---|
| `calendar-view.spec.ts` *(extended)* | `planCellChips` budget, `buildEventsByDay` with multi-day events |
| `calendar-month-grid.component.spec.ts` *(extended)* | The budget, the kind-aware overflow, the aria label |
| `calendar-day-view.component.spec.ts` | Ordering, all-day vs timed, task vs event affordances |
| `calendar-event-chip.component.spec.ts`, `calendar-event-detail.component.spec.ts` | No completion control anywhere |
| `task-list-page.component.spec.ts` | Today loads the date range, displays events separately, and opens event details |
| `e2e/specs/authenticated/calendar-events.spec.ts` | Add a source; see events in the month grid and the day view; assert an event has no checkbox and a task still completes |

**Exit criteria:** the feature is visible end to end; `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm format:check`, `pnpm docs:check` and the e2e suite are green.

### 12.4 New files

| File | Purpose |
|:---|:---|
| `apps/api/src/lib/calendar-fetch.ts` | SSRF-guarded fetch with timeouts, size/redirect caps, conditional GET |
| `apps/api/src/lib/calendar-parse.ts` | `ical.js` parse + window expansion + normalisation to `CalendarEventInput` |
| `apps/api/src/lib/calendar-encryption.ts` | Encrypt/decrypt source URLs; key derivation |
| `apps/api/src/lib/calendar-date.ts` | `assertCalendarDate`, extracted from `task-service.ts` so tasks and events share one rule |
| `apps/api/src/lib/calendar-local.ts` | Project a stored event onto the reader's zone: `dayKeys`, `startTime`, `endTime` (§6.3) |
| `apps/api/src/services/calendar-source-service.ts` | Source CRUD, duplicate detection, ownership |
| `apps/api/src/services/calendar-event-service.ts` | Window queries and the replace-on-refresh transaction |
| `apps/api/src/lib/calendar-refresh.ts` | Periodic job, due-source selection, backoff |
| `apps/api/src/routes/calendar.ts` | The six routes |
| `apps/api/src/lib/calendar-fetch.test.ts` | SSRF cases, redirects, size/time caps |
| `apps/api/src/lib/calendar-parse.test.ts` | All-day, TZID, floating, RRULE/EXDATE/RECURRENCE-ID, malformed VEVENTs |
| `apps/api/src/lib/calendar-local.test.ts` | Zone projection: absolute, floating, all-day, multi-day, DST boundaries |
| `apps/api/src/lib/calendar-encryption.test.ts` | Key derivation, round trip, a wrong key failing closed, the URL never logged |
| `apps/api/src/db/calendar-schema.test.ts` | The bootstrap, the uniqueness indexes, the cascades |
| `apps/api/src/services/calendar-event-service.test.ts` | Replace semantics, cancellations, window bounds, the zone-aware range |
| `apps/api/src/lib/calendar-refresh.test.ts` | Due-source selection, backoff progression, a failing source keeping its last good events |
| `apps/api/src/routes/calendar.test.ts` | Auth, ownership, validation, event payload |
| `apps/frontend/src/app/features/personal/components/calendar-event-chip/calendar-event-chip.component.ts` | Read-only event chip |
| `apps/frontend/src/app/features/personal/components/calendar-event-detail/calendar-event-detail.component.ts` | Read-only detail popover/sheet |
| `apps/frontend/src/app/features/personal/components/calendar-source-form/calendar-source-form.component.ts` | Reusable URL/name/colour form plus provider help; used by Settings and the onboarding dialog |
| `apps/frontend/src/app/features/personal/components/calendar-day-view/calendar-day-view.component.ts` | Agenda day view: all-day band, timed lane, untimed task checklist |
| `apps/frontend/src/app/features/personal/components/calendar-day-view/calendar-day-view.component.spec.ts` | Ordering, all-day vs timed, and task vs event affordances |
| `apps/frontend/src/app/core/services/calendar.service.ts` | Sources + events client |
| `apps/frontend/e2e/specs/authenticated/calendar-events.spec.ts` | Add a source; see events in the month grid and day view; assert events have no checkbox and tasks still complete |

### 12.5 Modified files

| File | Change |
|:---|:---|
| `apps/api/package.json` | Add `ical.js` |
| `apps/api/src/db/schema.ts` | `calendar_sources`, `calendar_events` |
| `apps/api/src/db/client.ts` | `CREATE TABLE` blocks, indexes, and `ALTER TABLE` guards |
| `apps/api/src/lib/timezone.ts` | `startOfNextDayInUtc` and `calendarRangeToInstants` — zone-aware date ranges for the events query (§8) |
| `apps/api/src/services/task-service.ts` | Import `assertCalendarDate` from `lib/calendar-date.ts` instead of defining it locally |
| `apps/api/src/server.ts` | Register `calendarRoutes`; start the refresh job |
| `apps/api/src/docs/openapi.ts` | Schemas for the six routes |
| `apps/api/src/services/user-service.ts` | Delete sources/events on account deletion |
| `packages/shared/src/domain.ts` | `CalendarSource`, `CalendarEvent`, `CalendarEventDto` types |
| `packages/shared/src/index.ts` / `frontend.ts` | Export the new types |
| `apps/frontend/src/app/features/personal/utils/calendar-view.ts` | `buildEventsByDay`/`buildDayAgenda`, `planCellChips`, extended cells with `events`, agenda ordering |
| `apps/frontend/src/app/features/personal/components/calendar-month-grid/calendar-month-grid.component.ts` | Render task and event chips with distinct chrome; keep drag task-only; the shared row budget and kind-aware overflow; update the cell aria label |
| `apps/frontend/src/app/features/personal/components/calendar-day-panel/calendar-day-panel.component.ts` | Retired in favour of `calendar-day-view` once the agenda lands |
| `apps/frontend/src/app/features/personal/pages/calendar-page/calendar-page.component.ts` | Wire `CalendarService`, the range, and the agenda day view |
| `apps/frontend/src/app/features/personal/pages/calendar-page/calendar-page.component.html` | Place the agenda in the right column / mobile sheet; separate task and event bands |
| `apps/frontend/src/app/features/personal/components/calendar-header/calendar-header.component.ts` | Compact Tasks/Events legend and an optional Day toggle |
| `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.ts` | Load today's event range, show read-only events beside the task list, open event details |
| `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.html` | Today's schedule panel: right column on wide screens, above Due Today on smaller screens |
| `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.spec.ts` | Today schedule loading, separate event rendering, read-only event details |
| `apps/frontend/src/app/core/services/preferences-store.service.ts` | Persist the month/day view preference when the toggle ships |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | Calendars section, reusing `calendar-source-form` |
| `apps/frontend/src/app/features/onboarding/pages/startup-wizard/startup-wizard.component.ts` | Ready-step calendar card, dialog state, source loading; never persists the URL; re-fetches sources on entering the Ready step |
| `apps/frontend/src/app/features/onboarding/pages/startup-wizard/startup-wizard.component.html` | Ready-step card and dialog markup |
| `apps/frontend/src/app/features/onboarding/pages/startup-wizard/startup-wizard.component.spec.ts` | Connect, skip, failure, and "URL not in draft" tests |
| `apps/api/.env.example` | `CALENDAR_ENCRYPTION_KEY`, `ALLOW_INSECURE_CALENDAR_URLS` |
| `docs/CONFIGURATION.md` | The same two variables — the CI `docs-consistency` job ties this file to `.env.example` |
| `docs/README.md` | Add this plan to the Active plans table |
| `DOCKER.md` | `CALENDAR_ENCRYPTION_KEY`, the insecure-URL opt-in, and server-side fetch expectations |

### 12.6 Before starting

- **The dependency choice is settled**: `ical.js` 2.2.1 over `node-ical`, because it is
  the recurrence/timezone engine and supports `RECURRENCE-ID`/`EXDATE` cleanly. The API is
  ESM and `ical.js` ships ESM with bundled types, so there is no interop work.
- **The encryption key story is settled** (§11.1): `CALENDAR_ENCRYPTION_KEY`, falling back
  to a key derived from `BETTER_AUTH_SECRET` via HKDF. That key and
  `ALLOW_INSECURE_CALENDAR_URLS` are documented in `apps/api/.env.example` and
  `docs/CONFIGURATION.md` in Part 1, because the CI `docs-consistency` job requires every
  variable in `.env.example` to be documented in `CONFIGURATION.md`.
- **The day-bucketing contract is settled** (§6.3, §8): the server owns it, `tz` is a
  query parameter on the events route, and the response carries `dayKeys`.
- Record a green baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`,
  `pnpm docs:check`.
- No migration file; the runtime bootstrap handles the new tables, matching existing
  practice.

## 13. Risks and limitations

| Risk | Mitigation |
|:---|:---|
| **SSRF via a user-supplied URL** | Scheme allowlist, private-IP rejection after DNS, redirect re-validation, size/time caps (§11.2) |
| **Source URL leaks** | Encrypted at rest, never returned, never logged; safe error messages (§11.1) |
| **The wizard leaks the URL into localStorage** | The Ready-step form keeps the URL in memory only; the persisted draft contains no secret (§10.6) |
| **Onboarding friction** | Calendar connection is an optional card, not a seventh step; Skip is one click; completion never waits on it (§10.6) |
| **A huge or hostile feed** | 5 MB cap, 10 s timeout, 10k-instance cap, per-VEVENT skip rather than whole-source failure |
| **Recurrence and timezone bugs** | `ical.js` expansion; tests for all-day, TZID, floating, EXDATE, RECURRENCE-ID, and DST |
| **The feed changes under us** | Full replace per source per window on every successful fetch, so cancellations and deletions disappear |
| **A provider breaks or the URL rotates** | `last_error` + backoff; the user re-adds or rotates the URL; last good events stay |
| **Duplicate sources** | `UNIQUE(user_id, url_hash)` |
| **Events pollute task features** | Separate table/service/API; the task pipeline never reads `calendar_events` |
| **Users conflate events with tasks** | Distinct chrome (no checkbox, source colour, calendar glyph), separate headings, a first-connect explainer, and a read-only detail (§4.3, §10.4). The E2E asserts an event has no completion control |
| **The day view drifts into a time grid** | §10.3 defines an agenda; overlap columns, drag/resize, and zoom are out of scope (§14). Overlapping rows stack rather than splitting into columns |
| **Event descriptions are untrusted** | Plain text only; no markdown/HTML rendering |
| **Account deletion leaves rows** | Add both tables to `deleteAccountForUser`; FKs cascade as a backstop |
| **Freshness expectations** | Inbound is Yotara-controlled: 15-minute default, manual refresh, and "last synced" in Settings |
| **An event lands on the wrong day** | The server owns day bucketing and projects onto the reader's zone from the request's `tz`; the range converts to a half-open instant range in that zone, so a DST day is 23 or 25 hours rather than a fixed 24 (§6.3, §8) |
| **A floating event shifts by the reader's offset** | A floating event is stored as its own wall clock read as UTC, and the display reads the UTC parts unchanged instead of re-projecting them, so a 09:00 standup stays at 09:00 everywhere (§6.3) |
| **A multi-day event is missing from a middle day** | The response carries `dayKeys`, so an event appears on every day it spans rather than only its start day (§6.3) |
| **A cell with both tasks and events hides a task** | One shared row budget per cell keeps the fixed-height grid uniform; the overflow is kind-aware, so the hidden task is discoverable (§10.2) |

## 14. Out of scope

- **OAuth providers** (Google Calendar API, Microsoft Graph, iCloud). They need app
  registration, token refresh, provider-specific event mapping, and — for self-hosted
  software — Google's sensitive-scope verification. An ICS URL needs none of that.
- **CalDAV** (read or write). A different protocol and a much larger surface.
- **Writing back to the source** — editing, deleting, or moving events, RSVP, reminders.
- **Automatic event → task import.** A future explicit *Create task from event* action can
  copy title/date; it is not a sync.
- **Attendees, organiser, attachments, conferencing links, alarms.** Privacy and size for
  little planning value.
- **Unbounded history.** The window is one month back to one year forward.
- **Team-shared sources.** Each user adds their own URLs; no workspace-level source model.
- **A time-grid day/week view.** Overlap columns, drag/resize, zoom, and a full
  Google-Calendar-style grid are out of scope. The day view is an agenda (§10.3).

## 15. Open questions

1. **Allow `http://` ICS URLs for LAN feeds?** Default no; an explicit env opt-in keeps
   self-hosters working without weakening the default.
2. **Is the window right?** One month back to twelve months forward covers the visible
   grid and planning; a wider window costs ingest time and rows.
3. **Encrypt event contents too, or only the source URL?** Event rows must be queryable by
   range, so plaintext is the pragmatic choice for a self-hosted DB; document it.
4. **Should events appear in Today/Upcoming as well as the Calendar page?** Resolved:
   show today's events in Today in v1, using a separate right-side schedule on wide
   screens and stacking it above Due Today on smaller screens. Keep Upcoming out of v1.
5. **What is the right inbound refresh interval?** 15 minutes feels live without hammering
   providers; conditional GET makes most polls free.
6. **Should the agenda day view become the desktop default, or sit beside the month grid?**
   The recommendation is month grid plus day agenda side by side on desktop, and day-first
   on mobile. A full-width Day toggle can follow if people ask for it.
7. **Should the Tasks/Events legend be always visible or a one-time explainer?** The
   recommendation is a compact always-visible legend in the calendar header, with the
   fuller explanation on first connect and in Settings.
8. **Ready-step card or a dedicated seventh step?** The recommendation is the Ready-step
   card: it keeps the wizard at six steps and avoids forcing a context switch. A dedicated
   step can follow if discovery turns out to be too low.
9. **Should a multi-day event draw a chip on every day it spans, or only on its start
   day?** The recommendation is every spanned day, matching Google Calendar, with the
   shared row budget absorbing the extra chips (§6.3, §10.2). Only the start day would
   make a Wednesday-to-Friday conference vanish from the Thursday agenda.
10. **Is a three-row shared budget between tasks and events enough?** The recommendation
    is three, matching today's task cap, so the fixed-height grid does not change
    (§10.2). A compact single event band is the fallback if the grid feels cramped.
